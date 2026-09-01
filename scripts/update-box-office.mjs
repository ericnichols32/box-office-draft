#!/usr/bin/env node
/**
 * Refreshes box-office figures using Claude with web search, then writes
 * src/data/figures.json.
 *
 * Two hard rules, both learned the hard way:
 *
 *  1. Every drafted film is looked up INDIVIDUALLY by name. Never filter a
 *     "top N" chart — a top-N chart cannot contain flops, so bombs silently
 *     vanish and every total comes out inflated.
 *  2. A gross may never decrease. Box office is cumulative, so a lower number
 *     means a bad lookup (wrong film, domestic mistaken for worldwide, a stale
 *     cache), not a real change. Suspicious values are flagged, not written.
 *
 * Usage: node scripts/update-box-office.mjs [--dry-run]
 */
import Anthropic from '@anthropic-ai/sdk';
import { fetchPosterUrl } from './wikipedia-poster.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIGURES_PATH = resolve(HERE, '../src/data/figures.json');
const DRY_RUN = process.argv.includes('--dry-run');
const SEASON = 2026;

// A single-day jump beyond either of these is treated as a bad lookup.
const MAX_DAILY_GROSS_JUMP_M = 400;
const MAX_GROSS_MULTIPLIER = 2.5;
// Budgets rarely move once a film is out, so anything past a small refinement
// is held for review. Every budget error found by hand was 17-33%.
const BUDGET_CHANGE_FLAG_PCT = 0.15;

/**
 * Decide whether a freshly looked-up gross may replace the stored one.
 * Cumulative gross can only rise, and it cannot rise absurdly fast.
 */
export function grossDecision(prev, next, elapsedDays) {
  if (typeof next !== 'number' || !Number.isFinite(next)) return { accept: false, reason: 'not-a-number' };
  if (prev === null || prev === undefined) return { accept: true, reason: 'first-value' };
  if (next < prev) return { accept: false, reason: 'gross-decreased' };
  if (next === prev) return { accept: false, reason: 'unchanged' };
  if (next - prev > MAX_DAILY_GROSS_JUMP_M * elapsedDays) return { accept: false, reason: 'gross-jump' };
  if (prev > 0 && next / prev > MAX_GROSS_MULTIPLIER) return { accept: false, reason: 'gross-jump' };
  return { accept: true, reason: 'ok' };
}

/** Budgets may be revised, but a big swing is held back for a human to confirm. */
export function budgetDecision(prev, next) {
  if (typeof next !== 'number' || !Number.isFinite(next) || next <= 0) return { accept: false, reason: 'not-a-number' };
  if (prev === null || prev === undefined) return { accept: true, reason: 'first-value' };
  if (next === prev) return { accept: false, reason: 'unchanged' };
  if (Math.abs(next - prev) / prev > BUDGET_CHANGE_FLAG_PCT) return { accept: false, reason: 'budget-swing' };
  return { accept: true, reason: 'ok' };
}

const figures = JSON.parse(readFileSync(FIGURES_PATH, 'utf8'));
const draftedIds = Object.keys(figures.drafted);
const draftedTitles = draftedIds.map((id) => figures.drafted[id].searchTitle);

const prompt = `You are updating a box-office scoreboard for the ${SEASON} film season. Today is ${new Date().toISOString().slice(0, 10)}.

TASK 1 — Look up each of these ${draftedIds.length} films INDIVIDUALLY and report its current worldwide box office gross and production budget. Search for each film by name separately. Do NOT read a "top grossing films of ${SEASON}" chart and fill in from that: films that flopped do not appear on such charts, and reporting them as "no data" corrupts the scoreboard. A film that made very little money still has a number, and that number matters as much as a blockbuster's.

${draftedIds.map((id) => `- id "${id}": ${figures.drafted[id].searchTitle}`).join('\n')}

For each film report:
- worldwideGrossMillions: cumulative WORLDWIDE gross in USD millions (not domestic). null only if the film has genuinely not released yet.
- productionBudgetMillions: production budget in USD millions. Where reporting gives a range or a figure that grew during production, use the TOTAL production spend including reshoots. null if no budget has been publicly reported.
- confidence: "high" | "medium" | "low"
- source: the outlet or site the figure came from

TASK 2 — Identify the 10 highest-grossing films RELEASED IN ${SEASON} worldwide that are NOT any of the films above. Include films from any market (Chinese, Indian, Japanese releases count). Exclude anything released before ${SEASON}. For each give: a short kebab-case id, title, releaseDate as "MMM D", productionBudgetMillions (null if unreported), worldwideGrossMillions, and source.

Reply with ONLY a JSON object in a \`\`\`json fenced block, no prose before or after:

{
  "drafted": [ { "id": "...", "worldwideGrossMillions": 0, "productionBudgetMillions": 0, "confidence": "high", "source": "..." } ],
  "missed":  [ { "id": "...", "title": "...", "releaseDate": "MMM D", "worldwideGrossMillions": 0, "productionBudgetMillions": 0, "source": "..." } ]
}`;

function extractJson(text) {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(raw);
}

function daysSince(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, ms / 86_400_000);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }

  const client = new Anthropic();
  console.log(`Looking up ${draftedIds.length} drafted films individually + discovering the top 10 missed...`);

  const stream = client.messages.stream({
    model: 'claude-opus-5',
    max_tokens: 32000,
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 60 }],
    messages: [{ role: 'user', content: prompt }],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === 'refusal') {
    console.error('Request was declined:', response.stop_details);
    process.exit(1);
  }

  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  let parsed;
  try {
    parsed = extractJson(text);
  } catch (err) {
    console.error('Could not parse a JSON payload from the reply:', err.message);
    console.error(text.slice(0, 2000));
    process.exit(1);
  }

  const elapsedDays = daysSince(figures.updatedAt);
  const flags = [];
  let changed = 0;

  for (const row of parsed.drafted ?? []) {
    const current = figures.drafted[row.id];
    if (!current) {
      flags.push({ id: row.id, kind: 'unknown-id', detail: 'not in the roster; ignored' });
      continue;
    }

    // ── Gross ────────────────────────────────────────────────────────────
    const next = row.worldwideGrossMillions;
    const g = grossDecision(current.gross, next, elapsedDays);
    if (g.accept) {
      current.gross = next;
      changed++;
    } else if (g.reason === 'gross-decreased' || g.reason === 'gross-jump') {
      flags.push({ id: row.id, kind: g.reason, detail: `${current.gross} -> ${next}; kept ${current.gross}`, source: row.source });
    }

    // ── Budget ───────────────────────────────────────────────────────────
    const nextBudget = row.productionBudgetMillions;
    const b = budgetDecision(current.budget, nextBudget);
    if (b.accept) {
      current.budget = nextBudget;
      changed++;
    } else if (b.reason === 'budget-swing') {
      flags.push({ id: row.id, kind: 'budget-swing', detail: `${current.budget} -> ${nextBudget}; kept ${current.budget}`, source: row.source });
    }

    if (row.confidence === 'low') {
      flags.push({ id: row.id, kind: 'low-confidence', detail: row.source ?? '' });
    }
  }

  // ── Missed list ────────────────────────────────────────────────────────
  const normalize = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const draftedNorm = new Set(draftedTitles.map(normalize));
  const missed = (parsed.missed ?? [])
    .filter((m) => {
      if (draftedNorm.has(normalize(m.title))) {
        flags.push({ id: m.id, kind: 'missed-overlaps-draft', detail: m.title });
        return false;
      }
      return typeof m.worldwideGrossMillions === 'number';
    })
    .sort((a, b) => b.worldwideGrossMillions - a.worldwideGrossMillions)
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      title: m.title,
      releaseDate: m.releaseDate ?? '',
      budget: typeof m.productionBudgetMillions === 'number' ? m.productionBudgetMillions : null,
      gross: m.worldwideGrossMillions,
    }));

  if (missed.length === 10) {
    // Carry poster URLs across for films already on the list; look up new ones.
    const known = new Map((figures.missed ?? []).map((m) => [m.id, m.posterUrl]));
    for (const m of missed) {
      if (known.get(m.id)) {
        m.posterUrl = known.get(m.id);
        continue;
      }
      const { posterUrl } = await fetchPosterUrl(`${m.title} ${SEASON} film`);
      m.posterUrl = posterUrl;
      if (!posterUrl) flags.push({ id: m.id, kind: 'no-poster', detail: `no Wikipedia poster for "${m.title}"` });
    }
    figures.missed = missed;
    changed++;
  } else {
    flags.push({ kind: 'missed-incomplete', detail: `only ${missed.length} usable rows; kept previous list` });
  }

  figures.updatedAt = new Date().toISOString();
  figures.flags = flags;

  console.log(`\n${changed} field(s) changed. ${flags.length} flag(s).`);
  for (const f of flags) console.log(`  ⚠ ${f.kind} ${f.id ?? ''} — ${f.detail}`);

  if (DRY_RUN) {
    console.log('\n--dry-run: nothing written.');
    return;
  }
  writeFileSync(FIGURES_PATH, JSON.stringify(figures, null, 2) + '\n');
  console.log(`\nWrote ${FIGURES_PATH}`);
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

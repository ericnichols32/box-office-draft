#!/usr/bin/env node
/**
 * Refreshes box-office figures from Wikipedia and writes src/data/figures.json.
 *
 * No API key, no account, no credits — the scoreboard must keep working
 * without anyone maintaining billing for it.
 *
 * Three rules, each learned the hard way in this project:
 *
 *  1. Every drafted film is looked up INDIVIDUALLY from its own article. The
 *     ranked top-grossing table is used ONLY to discover films nobody drafted,
 *     never to read a drafted film's gross — a top-N table cannot contain a
 *     flop, so bombs vanish from it and every total comes out inflated.
 *  2. A gross may never decrease. Box office is cumulative, so a lower number
 *     means a bad parse or the wrong article, not a real change.
 *  3. A pinned field is a human decision and is never overwritten. Michael's
 *     budget is $200M (production plus the estate-funded reshoots) even though
 *     the infobox cites $155M.
 *
 * Usage: node scripts/update-box-office.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fetchFigures, fetchTopGrossing } from './wikipedia-figures.mjs';
import { fetchPosterUrl } from './wikipedia-poster.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIGURES_PATH = resolve(HERE, '../src/data/figures.json');
const DRY_RUN = process.argv.includes('--dry-run');
const SEASON = 2026;

const MAX_DAILY_GROSS_JUMP_M = 400;
const MAX_GROSS_MULTIPLIER = 2.5;
const BUDGET_CHANGE_FLAG_PCT = 0.15;

/** Cumulative gross can only rise, and not absurdly fast. */
export function grossDecision(prev, next, elapsedDays) {
  if (typeof next !== 'number' || !Number.isFinite(next)) return { accept: false, reason: 'not-a-number' };
  if (prev === null || prev === undefined) return { accept: true, reason: 'first-value' };
  if (next === prev) return { accept: false, reason: 'unchanged' };
  if (next < prev) {
    // Infoboxes round ($1,136 million against our 1136.4). Keep the finer
    // value silently; only a real drop is worth a human's attention.
    const tolerance = Math.max(1, prev * 0.005);
    return prev - next <= tolerance
      ? { accept: false, reason: 'rounding' }
      : { accept: false, reason: 'gross-decreased' };
  }
  if (next - prev > MAX_DAILY_GROSS_JUMP_M * elapsedDays) return { accept: false, reason: 'gross-jump' };
  if (prev > 0 && next / prev > MAX_GROSS_MULTIPLIER) return { accept: false, reason: 'gross-jump' };
  return { accept: true, reason: 'ok' };
}

/** Budgets rarely move once a film is out; a real swing waits for a human. */
export function budgetDecision(prev, next) {
  if (typeof next !== 'number' || !Number.isFinite(next) || next <= 0) return { accept: false, reason: 'not-a-number' };
  if (prev === null || prev === undefined) return { accept: true, reason: 'first-value' };
  if (next === prev) return { accept: false, reason: 'unchanged' };
  if (Math.abs(next - prev) / prev > BUDGET_CHANGE_FLAG_PCT) return { accept: false, reason: 'budget-swing' };
  return { accept: true, reason: 'ok' };
}

/** Drops disambiguators so "The Odyssey (2026 Nolan)" matches "The Odyssey". */
export function normalizeTitle(s) {
  return (s ?? '')
    .replace(/\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function daysSince(iso) {
  return Math.max(1, (Date.now() - new Date(iso).getTime()) / 86_400_000);
}

async function main() {
  const figures = JSON.parse(readFileSync(FIGURES_PATH, 'utf8'));
  const elapsedDays = daysSince(figures.updatedAt);
  const flags = [];
  let changed = 0;

  // ── 1. Drafted films, one article at a time ──────────────────────────────
  const ids = Object.keys(figures.drafted);
  console.log(`Looking up ${ids.length} drafted films individually...`);

  for (const id of ids) {
    const entry = figures.drafted[id];
    const pinned = new Set(entry.pinned ?? []);
    const found = await fetchFigures(entry.searchTitle, SEASON);

    if (!found.article || found.wrongYear) {
      // Not yet released, or the only match is a different film in the series.
      continue;
    }

    if (!pinned.has('gross')) {
      const d = grossDecision(entry.gross, found.gross, elapsedDays);
      if (d.accept) {
        entry.gross = found.gross;
        changed++;
      } else if (d.reason === 'gross-decreased' || d.reason === 'gross-jump') {
        flags.push({ id, kind: d.reason, detail: `${entry.gross} -> ${found.gross}; kept ${entry.gross}` });
      }
    }

    if (!pinned.has('budget')) {
      const d = budgetDecision(entry.budget, found.budget);
      if (d.accept) {
        entry.budget = found.budget;
        changed++;
      } else if (d.reason === 'budget-swing') {
        flags.push({ id, kind: 'budget-swing', detail: `${entry.budget} -> ${found.budget}; kept ${entry.budget}` });
      }
    }
  }

  // ── 2. Discover films nobody drafted ─────────────────────────────────────
  console.log('Checking the highest-grossing table for films neither player drafted...');
  const draftedNorm = new Set(ids.map((id) => normalizeTitle(figures.drafted[id].searchTitle)));
  const table = await fetchTopGrossing(SEASON);

  // Candidates: anything in the ranked table that is not drafted, plus every
  // film already on the missed list, so a verified entry is never silently
  // dropped just because the table only runs ten deep.
  const candidates = new Map();
  for (const m of figures.missed ?? []) candidates.set(m.id, { ...m });
  for (const row of table) {
    if (draftedNorm.has(normalizeTitle(row.title))) continue;
    const id = normalizeTitle(row.title).slice(0, 40) || row.title.toLowerCase();
    const existing = [...candidates.values()].find((c) => normalizeTitle(c.title) === normalizeTitle(row.title));
    if (existing) {
      existing.gross = Math.max(existing.gross ?? 0, row.gross);
      continue;
    }
    candidates.set(id, { id, title: row.title, releaseDate: '', budget: null, gross: row.gross });
    flags.push({ id, kind: 'new-missed-film', detail: `${row.title} entered the top 10 at $${row.gross}M` });
  }

  // Refresh each candidate from its own article, then rank.
  for (const c of candidates.values()) {
    const found = await fetchFigures(`${c.title} ${SEASON} film`, SEASON);
    const d = grossDecision(c.gross, found.gross, elapsedDays);
    if (d.accept) c.gross = found.gross;
    if (c.budget === null && found.budget !== null) c.budget = found.budget;
    if (!c.posterUrl) {
      const { posterUrl } = await fetchPosterUrl(`${c.title} ${SEASON} film`);
      c.posterUrl = posterUrl;
      if (!posterUrl) flags.push({ id: c.id, kind: 'no-poster', detail: c.title });
    }
  }

  // Ranked by profit, matching how the draft is actually scored. A film with
  // no published budget has no computable profit and is left out rather than
  // shown with a blank column.
  const profit = (m) =>
    typeof m.gross === 'number' && typeof m.budget === 'number' ? m.gross - 2.5 * m.budget : null;

  for (const c of candidates.values()) {
    if (profit(c) === null) {
      flags.push({ id: c.id, kind: 'no-budget', detail: `${c.title} has no published budget; excluded` });
    }
  }

  const ranked = [...candidates.values()]
    .filter((c) => profit(c) !== null)
    .sort((a, b) => profit(b) - profit(a))
    .slice(0, 10);

  if (ranked.length === 10) {
    figures.missed = ranked;
    changed++;
  } else {
    flags.push({ kind: 'missed-incomplete', detail: `only ${ranked.length} usable rows; kept previous list` });
  }

  figures.updatedAt = new Date().toISOString();
  figures.flags = flags;

  console.log(`\n${changed} field(s) changed. ${flags.length} flag(s).`);
  for (const f of flags) console.log(`  ! ${f.kind} ${f.id ?? ''} — ${f.detail}`);

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
    console.error(`\nUpdate failed: ${err.message}\nNothing was written — the existing figures are untouched.\n`);
    if (process.env.RUNNER_DEBUG) console.error(err);
    process.exit(1);
  });
}

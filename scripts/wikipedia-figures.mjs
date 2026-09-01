/**
 * Reads budget and worldwide gross out of a film's Wikipedia infobox.
 *
 * This is the no-key data path: it needs no account, no credits, and no
 * billing, so the scoreboard keeps updating even when the paid API route is
 * unavailable. Values are parsed deterministically from the article wikitext
 * rather than summarized by a model, so a bad parse fails loudly instead of
 * inventing a plausible number.
 */

const API = 'https://en.wikipedia.org/w/api.php';
const UA = 'box-office-draft/1.0 (https://github.com/ericnichols32/box-office-draft) node-fetch';
const THROTTLE_MS = 1200;

let lastCall = 0;
async function polite(url) {
  const wait = Math.max(0, lastCall + THROTTLE_MS - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  return JSON.parse(await res.text());
}

/** Strips citations and markup that sit inside an infobox value. */
function clean(value) {
  return value
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<ref[\s\S]*?<\/ref>/gi, '')
    .replace(/\{\{nbsp\}\}/gi, ' ')
    // &nbsp; between the number and its unit is common and silently turned
    // "$2.335 billion" into 2.335 until it was handled here.
    .replace(/&nbsp;|&#160;|&thinsp;|&#8239;/gi, ' ')
    .replace(/\{\{(?:US\$|currency|val)\|([^}|]*)(?:\|[^}]*)?\}\}/gi, '$1')
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, '$2')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/'{2,}/g, '')
    .trim();
}

/**
 * Turns an infobox money string into USD millions.
 * Handles "$110 million", "$1.013 billion", "$170–200 million" (takes the low
 * end, matching how budgets are conventionally cited).
 */
export function parseMoneyMillions(text) {
  if (!text) return null;
  const s = clean(text).replace(/,/g, '');

  const m = s.match(/\$\s*([\d.]+)(?:\s*[–—-]\s*([\d.]+))?\s*(billion|million|bn|m\b)?/i);
  if (!m) return null;

  const low = parseFloat(m[1]);
  if (!Number.isFinite(low)) return null;

  const unit = (m[3] ?? '').toLowerCase();
  const scale = unit.startsWith('b') ? 1000 : 1;

  // A bare "$1,013,000,000" style figure with no unit word.
  if (!unit) return low > 1_000_000 ? low / 1_000_000 : low;
  return Math.round(low * scale * 100) / 100;
}

function infoboxField(wikitext, name) {
  const re = new RegExp(`\\|\\s*${name}\\s*=([\\s\\S]*?)(?=\\n\\s*\\||\\n\\}\\})`, 'i');
  const m = wikitext.match(re);
  return m ? m[1] : null;
}

async function articleWikitext(title) {
  const j = await polite(
    `${API}?action=query&format=json&redirects=1&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(title)}`,
  );
  const page = Object.values(j.query?.pages ?? {})[0];
  return page?.revisions?.[0]?.slots?.main?.['*'] ?? null;
}

async function findArticle(query) {
  const j = await polite(
    `${API}?action=query&format=json&list=search&srlimit=3&srsearch=${encodeURIComponent(query)}`,
  );
  return (j.query?.search ?? []).map((h) => h.title);
}

/**
 * True when the article's release date falls in the expected year.
 *
 * Without this, a search for an unreleased sequel happily lands on the
 * original: "Jumanji (2026 sequel)" matched the 1995 film and imported its
 * $65M budget and $263M gross onto a film that has not opened yet.
 */
export function releasedInYear(wikitext, year) {
  const released = infoboxField(wikitext, 'released');
  if (!released) return false;
  return new RegExp(`\\b${year}\\b`).test(clean(released));
}

/**
 * @param {string} query
 * @param {number} [year] when given, only an article released that year is accepted
 * @returns {Promise<{article: string|null, budget: number|null, gross: number|null}>}
 * budget and gross are USD millions.
 */
export async function fetchFigures(query, year) {
  try {
    const candidates = await findArticle(query);
    let fallback = null;
    for (const title of candidates) {
      const wikitext = await articleWikitext(title);
      if (!wikitext || !/\{\{Infobox film/i.test(wikitext)) continue;
      if (year && !releasedInYear(wikitext, year)) {
        fallback ??= { article: title, budget: null, gross: null, wrongYear: true };
        continue;
      }
      const budget = parseMoneyMillions(infoboxField(wikitext, 'budget'));
      const gross = parseMoneyMillions(infoboxField(wikitext, 'gross'));
      if (budget !== null || gross !== null) return { article: title, budget, gross };
    }
    return fallback ?? { article: candidates[0] ?? null, budget: null, gross: null };
  } catch (err) {
    return { article: null, budget: null, gross: null, error: err.message };
  }
}

/**
 * Parses the "Highest-grossing films of YEAR" table from the "YEAR in film"
 * article. Used ONLY to discover which films neither player drafted.
 *
 * It must never be the source for a drafted film's gross: a top-N table cannot
 * contain a flop, so reading figures from here makes bombs disappear and
 * inflates every total. Drafted films are always looked up individually.
 */
export function parseTopGrossing(wikitext) {
  const start = wikitext.search(/Highest-grossing films of \d{4}/i);
  if (start === -1) return [];
  const table = wikitext.slice(start, start + 20000);
  const end = table.indexOf('|}');
  const body = end === -1 ? table : table.slice(0, end);

  const rows = [];
  for (const chunk of body.split(/\n\|-/)) {
    const rank = chunk.match(/!\s*(\d+)/);
    const link = chunk.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
    const gross = chunk.match(/\|\s*\$([\d,]+)/);
    if (!rank || !link || !gross) continue;
    rows.push({
      rank: parseInt(rank[1], 10),
      article: link[1].trim(),
      title: (link[2] ?? link[1]).trim(),
      gross: Math.round((parseInt(gross[1].replace(/,/g, ''), 10) / 1_000_000) * 100) / 100,
    });
  }
  return rows.sort((a, b) => a.rank - b.rank);
}

/** Fetches the ranked highest-grossing list for a season. */
export async function fetchTopGrossing(year) {
  const j = await polite(
    `${API}?action=query&format=json&redirects=1&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(year + ' in film')}`,
  );
  const wikitext = Object.values(j.query?.pages ?? {})[0]?.revisions?.[0]?.slots?.main?.['*'];
  return wikitext ? parseTopGrossing(wikitext) : [];
}

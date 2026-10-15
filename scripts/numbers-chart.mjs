/**
 * Deeper discovery source: The Numbers' cumulative worldwide chart for a year.
 *
 * Wikipedia's "Highest-grossing films of YEAR" table only runs ten deep, and
 * every row of it is already drafted or on the list — so for six weeks nothing
 * new was ever discovered. Since the list is ranked by PROFIT, a cheap film
 * well outside the gross top ten can belong near the top: The King's Warden
 * made $123M on $6.9M, worth more than Scream 7.
 *
 * Only titles and grosses are read here; budgets still come from Wikipedia.
 * the-numbers.com/robots.txt names no wildcard rule and disallows only two
 * Amazon crawlers, so this is one polite request per run.
 */

const UA = 'box-office-draft/1.0 (https://github.com/ericnichols32/box-office-draft) node-fetch';

/** @returns {Promise<Array<{rank:number,title:string,gross:number}>>} millions USD */
export async function fetchNumbersChart(year) {
  const url = `https://www.the-numbers.com/box-office-records/worldwide/all-movies/cumulative/released-in-${year}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`The Numbers ${res.status}`);
  const html = await res.text();

  const rows = [];
  const re = /<b><a href="\/movie\/[^"]*">([^<]+)<\/a><\/b>[\s\S]*?\$([\d,]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const gross = Number(m[2].replace(/,/g, ''));
    if (!Number.isFinite(gross)) continue;
    rows.push({
      rank: rows.length + 1,
      // Strip the bracketed original-language title some rows carry.
      title: m[1].replace(/\s*\([^)]*[^\x00-\x7F][^)]*\)\s*$/, '').trim(),
      gross: Math.round((gross / 1_000_000) * 100) / 100,
    });
  }
  return rows;
}

/**
 * Resolves a film's poster image via the Wikipedia API.
 *
 * Chosen over TMDB because it needs no API key and no client-side request, and
 * over asking a model for image URLs directly, which yields plausible-looking
 * dead links. The model supplies a film name; the URL is derived deterministically.
 *
 * Note pilicense=any: film posters are non-free fair-use images, and the API's
 * default (free-licensed only) silently returns nothing for every one of them.
 */

const API = 'https://en.wikipedia.org/w/api.php';
// Wikipedia asks automated clients to identify themselves.
const UA = 'box-office-draft/1.0 (https://github.com/ericnichols32/box-office-draft) node-fetch';
const THROTTLE_MS = 1200;

let lastCall = 0;
async function polite(url) {
  const wait = Math.max(0, lastCall + THROTTLE_MS - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const body = await res.text();
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`Non-JSON reply: ${body.slice(0, 120)}`);
  }
}

/**
 * A film poster is copyrighted, so on Wikipedia it lives in the local en-wiki
 * upload space under a non-free-use rationale. Anything served from Commons is
 * freely licensed, which a poster never is — in practice it means the search
 * landed on a person or a place (a director's headshot, say) rather than the
 * film. Treat those as a miss.
 */
function isPoster(url) {
  return typeof url === 'string' && url.includes('/wikipedia/en/');
}

async function pageImage(article) {
  const page = await polite(
    `${API}?action=query&format=json&prop=pageimages&piprop=thumbnail&pilicense=any&pithumbsize=300&titles=${encodeURIComponent(article)}`,
  );
  const raw = Object.values(page.query?.pages ?? {})[0]?.thumbnail?.source ?? null;
  // Drop the analytics query string; keep a stable image URL.
  return raw ? raw.split('?')[0] : null;
}

/**
 * Walks the top few search hits and returns the first that yields a real
 * poster, so one imprecise match does not cost us the image.
 * @returns {Promise<{article: string|null, posterUrl: string|null}>}
 */
export async function fetchPosterUrl(query) {
  try {
    const search = await polite(
      `${API}?action=query&format=json&list=search&srlimit=3&srsearch=${encodeURIComponent(query)}`,
    );
    const hits = search.query?.search ?? [];
    if (!hits.length) return { article: null, posterUrl: null };

    for (const hit of hits) {
      const url = await pageImage(hit.title);
      if (isPoster(url)) return { article: hit.title, posterUrl: url };
    }
    return { article: hits[0].title, posterUrl: null };
  } catch (err) {
    return { article: null, posterUrl: null, error: err.message };
  }
}

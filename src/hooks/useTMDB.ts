import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Movie } from '../types';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string;
const BASE_URL = 'https://api.themoviedb.org/3';
const CACHE_KEY = 'tmdb_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface TMDBMovie {
  id: number;
  revenue: number;
  budget: number;
  poster_path: string | null;
  release_date?: string;
}

export interface TMDBResult {
  tmdbId: number | null;
  revenue: number | null;
  budget: number | null;
  posterPath: string | null;
  releaseDate: string | null; // "MMM D" to match the hardcoded draft format
}

interface CacheEntry extends TMDBResult {
  timestamp: number;
}

type Cache = Record<string, CacheEntry>;

const EMPTY: TMDBResult = {
  tmdbId: null,
  revenue: null,
  budget: null,
  posterPath: null,
  releaseDate: null,
};

// Entries written before posterPath was renamed still use TMDB's poster_path.
// Read them rather than discarding a cache we currently cannot refill.
type LegacyEntry = CacheEntry & { poster_path?: string | null };

function loadCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed: Record<string, LegacyEntry> = JSON.parse(raw);
    for (const entry of Object.values(parsed)) {
      if (entry.posterPath === undefined) entry.posterPath = entry.poster_path ?? null;
      if (entry.releaseDate === undefined) entry.releaseDate = null;
    }
    return parsed;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
}

function fmtReleaseDate(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * Look up a single movie by title. Used both by the draft-wide fetch below and
 * by the Top Missed Movies list, where the user types a title in the browser.
 */
export async function lookupMovieByTitle(title: string): Promise<TMDBResult> {
  if (!title.trim()) return EMPTY;
  try {
    // Search by title with year filter for 2026
    const searchRes = await axios.get(`${BASE_URL}/search/movie`, {
      params: { api_key: API_KEY, query: title, year: 2026 },
    });

    let result = searchRes.data.results?.[0];

    // If no result with year, try without year constraint
    if (!result) {
      const searchRes2 = await axios.get(`${BASE_URL}/search/movie`, {
        params: { api_key: API_KEY, query: title },
      });
      result = searchRes2.data.results?.[0];
    }

    if (!result) return EMPTY;

    const detailRes = await axios.get<TMDBMovie>(`${BASE_URL}/movie/${result.id}`, {
      params: { api_key: API_KEY },
    });

    const detail = detailRes.data;
    return {
      tmdbId: detail.id,
      revenue: detail.revenue > 0 ? detail.revenue / 1_000_000 : null,
      budget: detail.budget > 0 ? detail.budget / 1_000_000 : null,
      posterPath: detail.poster_path ?? result.poster_path ?? null,
      releaseDate: fmtReleaseDate(detail.release_date ?? result.release_date),
    };
  } catch {
    return EMPTY;
  }
}

export function useTMDB(movies: Movie[]): Movie[] {
  const [enriched, setEnriched] = useState<Movie[]>(movies);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      const cache = loadCache();
      const now = Date.now();
      const updated: Movie[] = [...movies];

      for (let i = 0; i < movies.length; i++) {
        const movie = movies[i];
        const cached = cache[movie.id];
        const stale = !cached || now - cached.timestamp > CACHE_TTL;

        let entry: CacheEntry;
        if (stale) {
          entry = { ...(await lookupMovieByTitle(movie.title)), timestamp: Date.now() };
          cache[movie.id] = entry;
          saveCache(cache);
        } else {
          entry = cached;
        }

        // Only fill in missing data — hardcoded values take priority
        updated[i] = {
          ...movie,
          tmdbId: entry.tmdbId ?? movie.tmdbId,
          posterPath: movie.posterPath !== undefined ? movie.posterPath : entry.posterPath,
          gross: movie.gross !== null ? movie.gross : entry.revenue,
          budget: movie.budget !== null ? movie.budget : entry.budget,
        };

        if (!cancelled) {
          setEnriched([...updated]);
        }
      }
    }

    fetchAll();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return enriched;
}

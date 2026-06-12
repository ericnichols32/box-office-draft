import { useState, useEffect } from 'react';
import axios from 'axios';
import type { Movie } from '../types';

const API_KEY = import.meta.env.VITE_TMDB_API_KEY as string;
const BASE_URL = 'https://api.themoviedb.org/3';
const CACHE_KEY = 'tmdb_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

interface TMDBMovie {
  id: number;
  revenue: number;
  budget: number;
  poster_path: string | null;
}

interface CacheEntry {
  timestamp: number;
  tmdbId: number | null;
  revenue: number | null;
  budget: number | null;
  poster_path: string | null;
}

type Cache = Record<string, CacheEntry>;

function loadCache(): Cache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
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

async function fetchTMDBData(_movieId: string, title: string): Promise<CacheEntry> {
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

    if (!result) {
      return { timestamp: Date.now(), tmdbId: null, revenue: null, budget: null, poster_path: null };
    }

    const detailRes = await axios.get<TMDBMovie>(`${BASE_URL}/movie/${result.id}`, {
      params: { api_key: API_KEY },
    });

    const detail = detailRes.data;
    return {
      timestamp: Date.now(),
      tmdbId: detail.id,
      revenue: detail.revenue > 0 ? detail.revenue / 1_000_000 : null,
      budget: detail.budget > 0 ? detail.budget / 1_000_000 : null,
      poster_path: detail.poster_path ?? result.poster_path ?? null,
    };
  } catch {
    return { timestamp: Date.now(), tmdbId: null, revenue: null, budget: null, poster_path: null };
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
          entry = await fetchTMDBData(movie.id, movie.title);
          cache[movie.id] = entry;
          saveCache(cache);
        } else {
          entry = cached;
        }

        // Only fill in missing data — hardcoded values take priority
        updated[i] = {
          ...movie,
          tmdbId: entry.tmdbId ?? movie.tmdbId,
          posterPath: movie.posterPath !== undefined ? movie.posterPath : entry.poster_path,
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

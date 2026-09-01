import type { DraftData, Movie } from '../types';
import figures from './figures.json';

interface FigureEntry { budget?: number | null; gross?: number | null }

// figures.json is refreshed by the scheduled box-office job and wins over the
// values below, which stay as a working fallback if that file is ever missing
// or the job has not run yet.
function withFigures(movies: Movie[]): Movie[] {
  const table = figures.drafted as Record<string, FigureEntry | undefined>;
  return movies.map((m) => {
    const entry = table[m.id];
    if (!entry) return m;
    return {
      ...m,
      budget: entry.budget !== undefined ? entry.budget : m.budget,
      gross: entry.gross !== undefined ? entry.gross : m.gross,
    };
  });
}

const roster: DraftData = {
  ericMovies: [
    {
      id: 'mario-galaxy',
      title: 'Super Mario Galaxy',
      releaseDate: 'Apr 1',
      budget: 110,
      gross: 1012.5,
    },
    {
      id: 'toy-story-5',
      title: 'Toy Story 5',
      releaseDate: 'Jun 19',
      budget: 250,
      gross: 1136.4,
    },
    {
      id: 'moana-2026',
      title: 'Moana (2026)',
      releaseDate: 'Jul 10',
      budget: 250,
      gross: 315.4,
    },
    {
      id: 'odyssey',
      title: 'The Odyssey',
      releaseDate: 'Jul 17',
      budget: 250,
      gross: 1555.2,
    },
    {
      id: 'spiderman-bnd',
      title: 'Spider-Man: Brand New Day',
      releaseDate: 'Jul 31',
      budget: 225,
      gross: 2333.0,
    },
    {
      id: 'paw-patrol-dino',
      title: 'Paw Patrol: The Dino',
      releaseDate: 'Aug 14',
      budget: 40,
      gross: 124.6,
    },
    {
      id: 'insidious-bleeding',
      title: 'Insidious 6',
      releaseDate: 'Aug 21',
      budget: 18,
      gross: 110.0,
      posterId: 'insidious6',
    },
    {
      id: 'clayface',
      title: 'Clayface',
      releaseDate: 'Oct 23',
      budget: null,
      gross: null,
      isBomb: true,
    },
    {
      id: 'godzilla-minus-zero',
      title: 'Godzilla Minus Zero',
      releaseDate: 'Nov 6',
      budget: null,
      gross: null,
    },
    {
      id: 'focker-in-law',
      title: 'Focker In Law',
      releaseDate: 'Nov 25',
      budget: null,
      gross: null,
    },
    {
      id: 'jumanji-sequel',
      title: 'Jumanji Sequel',
      releaseDate: 'Dec 11',
      budget: null,
      gross: null,
    },
  ],
  evanMovies: [
    {
      id: 'michael',
      title: 'Michael',
      releaseDate: 'Apr 24',
      budget: 200,
      gross: 1021.4,
    },
    {
      id: 'devil-wears-prada-2',
      title: 'Devil Wears Prada 2',
      releaseDate: 'May 1',
      budget: 100,
      gross: 692.8,
    },
    {
      id: 'mortal-kombat-2',
      title: 'Mortal Kombat 2',
      releaseDate: 'May 8',
      budget: 80,
      gross: 129.47,
    },
    {
      id: 'mandalorian-grogu',
      title: 'Mandalorian & Grogu',
      releaseDate: 'May 22',
      budget: 166,
      gross: 345,
    },
    {
      id: 'scary-movie-6',
      title: 'Scary Movie 6',
      releaseDate: 'Jun 5',
      budget: 30,
      gross: 231.5,
    },
    {
      id: 'masters-universe',
      title: 'Masters of the Universe',
      releaseDate: 'Jun 5',
      budget: 170,
      gross: 113.8,
      isBomb: true,
    },
    {
      id: 'disclosure-day',
      title: 'Disclosure Day',
      releaseDate: 'Jun 12',
      budget: 115,
      gross: 241.3,
    },
    {
      id: 'minions-monsters',
      title: 'Minions & Monsters',
      releaseDate: 'Jul 1',
      budget: 85,
      gross: 513.4,
    },
    {
      id: 'resident-evil-2026',
      title: 'Resident Evil (2026)',
      releaseDate: 'Sep 18',
      budget: null,
      gross: null,
    },
    {
      id: 'hunger-games-sequel',
      title: 'Hunger Games Sequel',
      releaseDate: 'Nov 20',
      budget: null,
      gross: null,
    },
    {
      id: 'werwulf',
      title: 'Werwulf',
      releaseDate: 'Dec 25',
      budget: null,
      gross: null,
    },
  ],
  bonuses: [
    {
      id: 'highest-overall',
      label: 'Highest Grossing Overall WW',
      ericPick: 'Spider-Man 4',
      evanPick: 'Super Mario Galaxy',
      winner: 'pending',
      value: 100,
    },
    {
      id: 'highest-studio',
      label: 'Highest Grossing Studio WW',
      ericPick: 'Disney',
      evanPick: 'Universal',
      winner: 'pending',
      value: 100,
    },
    {
      id: 'highest-original',
      label: 'Highest Grossing Original WW',
      ericPick: 'Disclosure Day',
      evanPick: 'Mother Mary',
      winner: 'pending',
      value: 100,
    },
    {
      id: 'highest-horror',
      label: 'Highest Grossing Horror WW',
      ericPick: 'Werwulf',
      evanPick: 'Werwulf',
      winner: 'pending',
      value: 100,
    },
  ],
  // Top 10 grossing 2026 films that neither Eric nor Evan drafted, ranked by
  // worldwide gross. Figures from The Numbers' 2026 worldwide chart (snapshot
  // 2026-09-01); budgets cross-checked against trade reporting. Maintained by
  // the scheduled box-office job — hand edits here will be overwritten.
  missedMovies: [
    {
      id: 'project-hail-mary',
      title: 'Project Hail Mary',
      releaseDate: 'Mar 20',
      budget: 200,   // net of tax incentives; $248M gross spend
      gross: 684.3,
    },
    {
      id: 'pegasus-3',
      title: 'Pegasus 3',
      releaseDate: 'Feb 17',
      budget: 80,
      gross: 641.1,
    },
    {
      id: 'obsession',
      title: 'Obsession',
      releaseDate: 'May 15',
      budget: 0.75,
      gross: 505.7,
    },
    {
      id: 'backrooms',
      title: 'Backrooms',
      releaseDate: 'May 29',
      budget: 10,
      gross: 393.2,
    },
    {
      id: 'hoppers',
      title: 'Hoppers',
      releaseDate: 'Mar 6',
      budget: 150,
      gross: 389.7,
    },
    {
      id: 'kung-fu-soccer',
      title: 'Kung Fu Soccer',
      releaseDate: 'Jul 11',
      budget: 53,    // CN¥380M converted
      gross: 306.2,
    },
    {
      id: 'dear-you',
      title: 'Dear You',
      releaseDate: 'Apr 30',
      budget: 2.06,  // CN¥14M converted
      gross: 276.6,
    },
    {
      id: 'wuthering-heights',
      title: 'Wuthering Heights',
      releaseDate: 'Feb 13',
      budget: 80,
      gross: 241.7,
    },
    {
      id: 'all-wishes-come-true',
      title: 'All Wishes Come True!',
      releaseDate: 'Aug 14',
      budget: null,  // no budget publicly reported
      gross: 232.0,
    },
    {
      id: 'scream-7',
      title: 'Scream 7',
      releaseDate: 'Feb 27',
      budget: 45,
      gross: 213.8,
    },
  ],
};

export const draftData: DraftData = {
  ...roster,
  ericMovies: withFigures(roster.ericMovies),
  evanMovies: withFigures(roster.evanMovies),
  missedMovies: (figures.missed?.length ? figures.missed : roster.missedMovies) as Movie[],
};

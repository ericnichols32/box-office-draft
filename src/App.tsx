import { useState, useEffect } from 'react';
import './App.css';
import { draftData } from './data/draft';
import { PlayerColumn } from './components/PlayerColumn';
import { BonusSection } from './components/BonusSection';
import { MissedMovies } from './components/MissedMovies';
import type { Movie, PredictionBonus } from './types';

type MovieOverrides = Record<string, { budget?: number | null; gross?: number | null; customPoster?: string | null }>;
type BonusOverrides = Record<string, { ericPickGross?: number | null; evanPickGross?: number | null }>;
type MissedOverrides = Record<string, Partial<Movie>>;

function loadMovieOverrides(): MovieOverrides {
  try { return JSON.parse(localStorage.getItem('draft_overrides') ?? '{}'); } catch { return {}; }
}
function loadBonusOverrides(): BonusOverrides {
  try { return JSON.parse(localStorage.getItem('bonus_overrides') ?? '{}'); } catch { return {}; }
}

// Missed movies live in the repo and are refreshed by the scheduled box-office
// job, so only explicit hand edits are stored here. Caching the whole list
// locally would shadow every future update.
function loadMissedOverrides(): MissedOverrides {
  try { return JSON.parse(localStorage.getItem('missed_overrides') ?? '{}'); } catch { return {}; }
}

function applyMovieOverrides(movies: Movie[], overrides: MovieOverrides): Movie[] {
  return movies.map((m) => {
    const ov = overrides[m.id];
    if (!ov) return m;
    return {
      ...m,
      budget: 'budget' in ov ? ov.budget ?? m.budget : m.budget,
      gross: 'gross' in ov ? ov.gross ?? m.gross : m.gross,
      customPoster: 'customPoster' in ov ? ov.customPoster : m.customPoster,
    };
  });
}

function applyBonusOverrides(bonuses: PredictionBonus[], overrides: BonusOverrides): PredictionBonus[] {
  return bonuses.map((b) => {
    const ov = overrides[b.id];
    if (!ov) return b;
    return {
      ...b,
      ericPickGross: 'ericPickGross' in ov ? ov.ericPickGross : b.ericPickGross,
      evanPickGross: 'evanPickGross' in ov ? ov.evanPickGross : b.evanPickGross,
    };
  });
}

function effectiveWinner(b: PredictionBonus): 'eric' | 'evan' | 'both' | 'pending' {
  if (b.ericPickGross != null && b.evanPickGross != null) {
    if (b.ericPickGross > b.evanPickGross) return 'eric';
    if (b.evanPickGross > b.ericPickGross) return 'evan';
    return 'both';
  }
  return b.winner;
}

function calcTotal(movies: Movie[], bonuses: PredictionBonus[], player: 'eric' | 'evan') {
  const movieTotal = movies.reduce((sum, m) => {
    if (m.gross === null || m.budget === null) return sum;
    return sum + (m.gross - 2.5 * m.budget);
  }, 0);
  const bonusTotal = bonuses.reduce((sum, b) => {
    const w = effectiveWinner(b);
    if (w === player || w === 'both') return sum + b.value;
    return sum;
  }, 0);
  return movieTotal + bonusTotal;
}

function App() {
  const [movieOverrides, setMovieOverrides] = useState<MovieOverrides>(loadMovieOverrides);
  const [bonusOverrides, setBonusOverrides] = useState<BonusOverrides>(loadBonusOverrides);
  const [missedOverrides, setMissedOverrides] = useState<MissedOverrides>(loadMissedOverrides);

  useEffect(() => {
    localStorage.setItem('draft_overrides', JSON.stringify(movieOverrides));
  }, [movieOverrides]);

  useEffect(() => {
    localStorage.setItem('bonus_overrides', JSON.stringify(bonusOverrides));
  }, [bonusOverrides]);

  useEffect(() => {
    localStorage.setItem('missed_overrides', JSON.stringify(missedOverrides));
  }, [missedOverrides]);

  const ericMovies = applyMovieOverrides(draftData.ericMovies, movieOverrides);
  const evanMovies = applyMovieOverrides(draftData.evanMovies, movieOverrides);
  const bonuses = applyBonusOverrides(draftData.bonuses, bonusOverrides);
  const missedMovies = draftData.missedMovies.map((m) => ({ ...m, ...missedOverrides[m.id] }));

  const handleMovieChange = (field: 'budget' | 'gross') => (id: string, val: number | null) => {
    setMovieOverrides((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  };

  const handlePosterChange = (id: string, dataUrl: string) => {
    setMovieOverrides((prev) => ({ ...prev, [id]: { ...prev[id], customPoster: dataUrl } }));
  };

  const handleBonusGrossChange = (id: string, field: 'ericPickGross' | 'evanPickGross', val: number | null) => {
    setBonusOverrides((prev) => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  };

  const patchMissed = (id: string, patch: Partial<Movie>) => {
    setMissedOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  // The scheduled job owns this list, so a hand edit is just a local override.
  const handleMissedTitleChange = (id: string, title: string) => {
    patchMissed(id, { title });
  };

  const ericTotal = calcTotal(ericMovies, bonuses, 'eric');
  const evanTotal = calcTotal(evanMovies, bonuses, 'evan');

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-subtitle">2026 SEASON</div>
          <h1 className="header-title">Box Office Draft</h1>
          <div className="header-tagline">Eric vs Evan — May the best picks win</div>
        </div>
      </header>

      <main className="app-main">
        <div className="columns">
          <PlayerColumn
            playerName="Eric"
            movies={ericMovies}
            bonuses={bonuses}
            player="eric"
            isLeading={ericTotal > evanTotal}
            onBudgetChange={handleMovieChange('budget')}
            onGrossChange={handleMovieChange('gross')}
            onPosterChange={handlePosterChange}
          />
          <PlayerColumn
            playerName="Evan"
            movies={evanMovies}
            bonuses={bonuses}
            player="evan"
            isLeading={evanTotal > ericTotal}
            onBudgetChange={handleMovieChange('budget')}
            onGrossChange={handleMovieChange('gross')}
            onPosterChange={handlePosterChange}
          />
        </div>

        <BonusSection bonuses={bonuses} onGrossChange={handleBonusGrossChange} />

        <MissedMovies
          movies={missedMovies}
          onBudgetChange={(id, val) => patchMissed(id, { budget: val })}
          onGrossChange={(id, val) => patchMissed(id, { gross: val })}
          onPosterChange={(id, dataUrl) => patchMissed(id, { customPoster: dataUrl })}
          onTitleChange={handleMissedTitleChange}
          onDateChange={(id, val) => patchMissed(id, { releaseDate: val })}
        />
      </main>

      <footer className="app-footer">
        <p>Profit = Worldwide Gross − (2.5 × Production Budget) &nbsp;|&nbsp; Prediction Bonuses worth $100M each &nbsp;|&nbsp; Figures refreshed daily &nbsp;|&nbsp; Posters via Wikipedia</p>
      </footer>
    </div>
  );
}

export default App;

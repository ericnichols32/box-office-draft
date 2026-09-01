import type { Movie } from '../types';
import { MovieRow } from './MovieRow';
import { needsFigures } from '../utils/release';

interface Props {
  movies: Movie[];
  onBudgetChange: (id: string, val: number | null) => void;
  onGrossChange: (id: string, val: number | null) => void;
  onPosterChange: (id: string, dataUrl: string) => void;
  onTitleChange: (id: string, val: string) => void;
  onDateChange: (id: string, val: string) => void;
}

function calcProfit(movie: Movie): number | null {
  if (movie.gross === null || movie.budget === null) return null;
  return movie.gross - 2.5 * movie.budget;
}

function fmt(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}B`;
  return `${sign}$${abs.toFixed(1)}M`;
}

export const MissedMovies: React.FC<Props> = ({
  movies,
  onBudgetChange,
  onGrossChange,
  onPosterChange,
  onTitleChange,
  onDateChange,
}) => {
  const incomplete = movies.filter((m) => needsFigures(m)).length;
  const totalProfit = movies.reduce((sum, m) => {
    const p = calcProfit(m);
    return sum + (p !== null ? p : 0);
  }, 0);

  return (
    <div className="missed-section">
      <div className="missed-header">
        <h3 className="missed-title">🎯 Top Missed Movies</h3>
        <div className="missed-subtitle">
          The most profitable 2026 films neither of us drafted
        </div>
      </div>

      <div className="missed-summary">
        {incomplete > 0 && (
          <div className="missed-summary-item">
            <span className="missed-summary-label">Needs Figures</span>
            <span className="missed-summary-value stat-missing">⚠ {incomplete}</span>
          </div>
        )}
        <div className="missed-summary-item">
          <span className="missed-summary-label">Profit Left On The Table</span>
          <span className={`missed-summary-value ${totalProfit >= 0 ? 'profit-positive' : 'profit-negative'}`}>
            {fmt(totalProfit)}
          </span>
        </div>
      </div>

      <div className="missed-list">
        {movies.map((movie, i) => (
          <MovieRow
            key={movie.id}
            movie={movie}
            rank={i + 1}
            noLocalPoster
            onBudgetChange={onBudgetChange}
            onGrossChange={onGrossChange}
            onPosterChange={onPosterChange}
            onTitleChange={onTitleChange}
            onDateChange={onDateChange}
          />
        ))}
      </div>

      <div className="missed-hint">
        Refreshed daily. Click any value to override it in this browser.
      </div>
    </div>
  );
};

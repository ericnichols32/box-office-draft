import type { Movie, PredictionBonus } from '../types';
import { MovieRow } from './MovieRow';

interface Props {
  playerName: string;
  movies: Movie[];
  bonuses: PredictionBonus[];
  player: 'eric' | 'evan';
  isLeading: boolean;
  onBudgetChange: (id: string, val: number | null) => void;
  onGrossChange: (id: string, val: number | null) => void;
  onPosterChange: (id: string, dataUrl: string) => void;
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

function countReleased(movies: Movie[]): number {
  const now = new Date();
  const months: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
  };
  return movies.filter((m) => {
    const parts = m.releaseDate.split(' ');
    if (parts.length === 2) {
      const month = months[parts[0]];
      const day = parseInt(parts[1]);
      if (!isNaN(month) && !isNaN(day)) return new Date(2026, month, day) <= now;
    }
    const d = new Date(m.releaseDate);
    return !isNaN(d.getTime()) && d <= now;
  }).length;
}

export const PlayerColumn: React.FC<Props> = ({
  playerName,
  movies,
  bonuses,
  player,
  isLeading,
  onBudgetChange,
  onGrossChange,
  onPosterChange,
}) => {
  const movieTotal = movies.reduce((sum, m) => {
    const p = calcProfit(m);
    return sum + (p !== null ? p : 0);
  }, 0);

  const bonusTotal = bonuses.reduce((sum, b) => {
    const w = (b.ericPickGross != null && b.evanPickGross != null)
      ? (b.ericPickGross > b.evanPickGross ? 'eric' : b.evanPickGross > b.ericPickGross ? 'evan' : 'both')
      : b.winner;
    if (w === player || w === 'both') return sum + b.value;
    return sum;
  }, 0);

  const total = movieTotal + bonusTotal;
  const released = countReleased(movies);

  return (
    <div className={`player-column ${isLeading ? 'leading' : ''}`}>
      <div className="player-header">
        <div className="player-name-row">
          <h2 className="player-name" style={{ color: isLeading ? '#f5c842' : '#fff' }}>{playerName}</h2>
          {isLeading && <span className="leading-crown">👑</span>}
        </div>
        <div className="player-total" style={{ color: isLeading ? '#f5c842' : '#fff' }}>
          {fmt(total)}
        </div>
        <div className="player-released-capsule">{released}/{movies.length} released</div>
      </div>

      <div className="movies-list">
        {movies.map((movie) => (
          <MovieRow
            key={movie.id}
            movie={movie}
            onBudgetChange={onBudgetChange}
            onGrossChange={onGrossChange}
            onPosterChange={onPosterChange}
          />
        ))}
      </div>
    </div>
  );
};

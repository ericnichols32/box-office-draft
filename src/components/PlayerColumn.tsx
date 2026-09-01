import type { Movie, PredictionBonus } from '../types';
import { MovieRow } from './MovieRow';
import { isReleased, needsFigures } from '../utils/release';

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
  return movies.filter((m) => isReleased(m.releaseDate)).length;
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
  const incomplete = movies.filter((m) => needsFigures(m)).length;

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
        <div className="player-capsules">
          <div className="player-released-capsule">{released}/{movies.length} released</div>
          {incomplete > 0 && (
            <div className="player-needs-capsule" title="Released films still missing budget or gross">
              ⚠ {incomplete} need{incomplete === 1 ? 's' : ''} figures
            </div>
          )}
        </div>
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

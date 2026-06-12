import type { Movie, PredictionBonus } from '../types';

interface Props {
  ericMovies: Movie[];
  evanMovies: Movie[];
  bonuses: PredictionBonus[];
}

function calcProfit(movie: Movie): number | null {
  if (movie.gross === null) return null;
  if (movie.budget === null) return null;
  return movie.gross - 2.5 * movie.budget;
}

function calcTotal(movies: Movie[], bonuses: PredictionBonus[], player: 'eric' | 'evan'): number {
  const movieTotal = movies.reduce((sum, m) => {
    const p = calcProfit(m);
    return sum + (p !== null ? p : 0);
  }, 0);
  const bonusTotal = bonuses.reduce((sum, b) => {
    if (b.winner === player || b.winner === 'both') return sum + b.value;
    return sum;
  }, 0);
  return movieTotal + bonusTotal;
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
      if (!isNaN(month) && !isNaN(day)) {
        return new Date(2026, month, day) <= now;
      }
    }
    const d = new Date(m.releaseDate);
    return !isNaN(d.getTime()) && d <= now;
  }).length;
}

function fmt(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}B`;
  return `${sign}$${abs.toFixed(1)}M`;
}

export const Scoreboard: React.FC<Props> = ({ ericMovies, evanMovies, bonuses }) => {
  const ericTotal = calcTotal(ericMovies, bonuses, 'eric');
  const evanTotal = calcTotal(evanMovies, bonuses, 'evan');
  const diff = Math.abs(ericTotal - evanTotal);
  const leader = ericTotal > evanTotal ? 'Eric' : evanTotal > ericTotal ? 'Evan' : null;
  const ericReleased = countReleased(ericMovies);
  const evanReleased = countReleased(evanMovies);

  return (
    <div className="scoreboard">
      <div className={`score-card ${leader === 'Eric' ? 'leader' : ''}`}>
        <div className="score-name">Eric</div>
        <div className="score-total" style={{ color: leader === 'Eric' ? '#f5c842' : '#fff' }}>
          {fmt(ericTotal)}
        </div>
        <div className="score-released">{ericReleased}/{ericMovies.length} released</div>
        {leader === 'Eric' && <div className="score-badge">LEADING</div>}
      </div>

      <div className="score-vs">
        <div className="score-vs-text">VS</div>
        {leader && (
          <div className="score-diff">
            {leader} leads by {fmt(diff)}
          </div>
        )}
      </div>

      <div className={`score-card ${leader === 'Evan' ? 'leader' : ''}`}>
        <div className="score-name">Evan</div>
        <div className="score-total" style={{ color: leader === 'Evan' ? '#f5c842' : '#fff' }}>
          {fmt(evanTotal)}
        </div>
        <div className="score-released">{evanReleased}/{evanMovies.length} released</div>
        {leader === 'Evan' && <div className="score-badge">LEADING</div>}
      </div>
    </div>
  );
};

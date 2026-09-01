// Draft dates are stored as "MMM D" without a year, so they are read against
// the season year rather than parsed as free-form dates.
export const SEASON_YEAR = 2026;

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

export function isReleased(releaseDate: string, now: Date = new Date()): boolean {
  if (!releaseDate) return false;

  const parts = releaseDate.trim().split(/\s+/);
  if (parts.length === 2) {
    const month = MONTHS[parts[0]];
    const day = parseInt(parts[1], 10);
    if (month !== undefined && !isNaN(day)) {
      return new Date(SEASON_YEAR, month, day) <= now;
    }
  }

  const parsed = new Date(releaseDate);
  return !isNaN(parsed.getTime()) && parsed <= now;
}

// A film already in theatres but still missing figures needs a human to go look
// the number up — silently showing a dash is how a real bomb stays hidden.
export function needsFigures(
  movie: { releaseDate: string; budget: number | null; gross: number | null },
  now: Date = new Date(),
): boolean {
  return isReleased(movie.releaseDate, now) && (movie.budget === null || movie.gross === null);
}

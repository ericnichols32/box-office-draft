export interface Movie {
  id: string;
  title: string;
  releaseDate: string; // "YYYY-MM-DD" or "MMM DD"
  budget: number | null; // in millions
  gross: number | null;  // in millions
  isBomb?: boolean;      // bomb pick assigned to this player
  tmdbId?: number;
  posterPath?: string | null;
  customPoster?: string | null;  // base64 data URL from user upload
  posterId?: string;             // override filename used for /posters/{posterId}.jpg
}

export interface PredictionBonus {
  id: string;
  label: string;
  ericPick: string;
  evanPick: string;
  ericPickGross?: number | null;  // current gross of Eric's pick, in millions
  evanPickGross?: number | null;  // current gross of Evan's pick, in millions
  winner: 'eric' | 'evan' | 'both' | 'pending';
  value: number; // in millions
}

export interface DraftData {
  ericMovies: Movie[];
  evanMovies: Movie[];
  bonuses: PredictionBonus[];
  missedMovies: Movie[]; // top grossing films neither player drafted — display only, not scored
}

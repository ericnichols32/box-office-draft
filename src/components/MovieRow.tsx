import React, { useState, useRef } from 'react';
import type { Movie } from '../types';

interface Props {
  movie: Movie;
  onBudgetChange: (id: string, val: number | null) => void;
  onGrossChange: (id: string, val: number | null) => void;
  onPosterChange: (id: string, dataUrl: string) => void;
}

function calcProfit(movie: Movie): number | null {
  if (movie.gross === null || movie.budget === null) return null;
  return movie.gross - 2.5 * movie.budget;
}

function fmtProfit(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '+';
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}B`;
  return `${sign}$${abs.toFixed(0)}M`;
}

function fmtMoney(val: number | null): string {
  if (val === null) return '—';
  if (val >= 1000) return `$${(val / 1000).toFixed(2)}B`;
  return `$${val.toFixed(0)}M`;
}

interface EditFieldProps {
  value: number | null;
  label: string;
  onSave: (val: number | null) => void;
}

const EditField: React.FC<EditFieldProps> = ({ value, label, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value !== null ? String(value) : '');
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = () => {
    const parsed = parseFloat(draft);
    onSave(isNaN(parsed) ? null : parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="movie-stat">
        <span className="stat-label">{label}</span>
        <input
          ref={inputRef}
          className="stat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="$M"
        />
      </div>
    );
  }

  return (
    <div className="movie-stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value stat-editable" onClick={startEdit} title={`Edit ${label}`}>
        {fmtMoney(value)}
      </span>
    </div>
  );
};

export const MovieRow: React.FC<Props> = ({ movie, onBudgetChange, onGrossChange, onPosterChange }) => {
  const profit = calcProfit(movie);
  const fileInputRef = useRef<HTMLInputElement>(null);

  let profitClass = 'profit-neutral';
  if (profit !== null) profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';

  // Priority: 1) local file in /posters/  2) uploaded via browser  3) TMDB  4) placeholder
  const localPoster = `/posters/${movie.posterId ?? movie.id}.jpg`;
  const [localPosterFailed, setLocalPosterFailed] = React.useState(false);

  const posterSrc = !localPosterFailed
    ? localPoster
    : movie.customPoster
    ? movie.customPoster
    : movie.posterPath
    ? `https://image.tmdb.org/t/p/w92${movie.posterPath}`
    : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) onPosterChange(movie.id, result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div className={`movie-row ${movie.isBomb ? 'bomb-row' : ''}`}>
      {/* Poster with hover upload overlay */}
      <div className="movie-poster-col">
      <div className="movie-poster-wrap" onClick={() => fileInputRef.current?.click()} title="Upload poster">
        {posterSrc ? (
          <img
            className="movie-poster"
            src={posterSrc}
            alt={movie.title}
            onError={() => {
              if (!localPosterFailed) setLocalPosterFailed(true);
            }}
          />
        ) : (
          <div className="movie-poster-placeholder">
            {movie.title.charAt(0)}
          </div>
        )}
        <div className="poster-upload-overlay">✎</div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
      {movie.isBomb && <span className="bomb-emoji">💣</span>}
      </div>

      {/* Title + date */}
      <div className="movie-info">
        <div className="movie-title">{movie.title}</div>
        <div className="movie-date">{movie.releaseDate}</div>
      </div>

      {/* Budget / Gross / Profit */}
      <div className="movie-figures">
        <EditField label="Budget" value={movie.budget} onSave={(val) => onBudgetChange(movie.id, val)} />
        <EditField label="Gross"  value={movie.gross}  onSave={(val) => onGrossChange(movie.id, val)} />
        <div className="movie-stat">
          <span className="stat-label">Profit</span>
          <span className={`stat-value ${profitClass}`}>
            {profit !== null ? fmtProfit(profit) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

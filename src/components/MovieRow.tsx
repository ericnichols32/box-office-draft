import React, { useState, useRef } from 'react';
import type { Movie } from '../types';
import { needsFigures, isReleased } from '../utils/release';

interface Props {
  movie: Movie;
  rank?: number;              // shows a rank badge (Top Missed Movies)
  noLocalPoster?: boolean;    // skip the /posters/{id}.jpg lookup for user-entered movies
  onBudgetChange: (id: string, val: number | null) => void;
  onGrossChange: (id: string, val: number | null) => void;
  onPosterChange: (id: string, dataUrl: string) => void;
  onTitleChange?: (id: string, val: string) => void;  // when set, title is click-to-edit
  onDateChange?: (id: string, val: string) => void;   // when set, date is click-to-edit
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
  // Micro-budgets are the whole story for some films — don't round them to $1M.
  if (val < 10) return `$${val.toFixed(2).replace(/\.?0+$/, '')}M`;
  return `$${val.toFixed(0)}M`;
}

interface EditFieldProps {
  value: number | null;
  label: string;
  missing?: boolean;
  onSave: (val: number | null) => void;
}

const EditField: React.FC<EditFieldProps> = ({ value, label, missing, onSave }) => {
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
      <span
        className={`stat-value stat-editable ${missing ? 'stat-missing' : ''}`}
        onClick={startEdit}
        title={missing ? `Released — ${label.toLowerCase()} still missing, click to add` : `Edit ${label}`}
      >
        {missing ? 'Add' : fmtMoney(value)}
      </span>
    </div>
  );
};

interface EditTextProps {
  value: string;
  placeholder: string;
  className: string;
  onSave: (val: string) => void;
}

const EditText: React.FC<EditTextProps> = ({ value, placeholder, className, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const commit = () => {
    onSave(draft.trim());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`${className} text-input`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <div className={`${className} text-editable`} onClick={startEdit} title="Click to edit">
      {value || <span className="text-placeholder">{placeholder}</span>}
    </div>
  );
};

export const MovieRow: React.FC<Props> = ({
  movie,
  rank,
  noLocalPoster,
  onBudgetChange,
  onGrossChange,
  onPosterChange,
  onTitleChange,
  onDateChange,
}) => {
  const profit = calcProfit(movie);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const released = isReleased(movie.releaseDate);
  const incomplete = needsFigures(movie);

  let profitClass = 'profit-neutral';
  if (profit !== null) profitClass = profit >= 0 ? 'profit-positive' : 'profit-negative';

  // Priority: 1) uploaded via browser  2) local file in /posters/  3) remote poster  4) placeholder
  // A hand-uploaded poster is deliberate, so it outranks the bundled default.
  // BASE_URL keeps this correct under the /box-office-draft/ Pages base path.
  const localPoster = `${import.meta.env.BASE_URL}posters/${movie.posterId ?? movie.id}.jpg`;
  const [localPosterFailed, setLocalPosterFailed] = React.useState(!!noLocalPoster);

  const posterSrc = movie.customPoster
    ? movie.customPoster
    : !localPosterFailed
    ? localPoster
    : movie.posterUrl
    ? movie.posterUrl
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
    <div className={`movie-row ${movie.isBomb ? 'bomb-row' : ''} ${incomplete ? 'needs-data' : ''}`}>
      {rank != null && <div className="movie-rank">{rank}</div>}

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
        {onTitleChange ? (
          <EditText
            value={movie.title}
            placeholder="Movie title"
            className="movie-title"
            onSave={(val) => onTitleChange(movie.id, val)}
          />
        ) : (
          <div className="movie-title">{movie.title}</div>
        )}
        <div className="movie-date-row">
          {onDateChange ? (
            <EditText
              value={movie.releaseDate}
              placeholder="Release date"
              className="movie-date"
              onSave={(val) => onDateChange(movie.id, val)}
            />
          ) : (
            <div className="movie-date">{movie.releaseDate}</div>
          )}
          {incomplete && (
            <span className="needs-data-flag" title="Released, but figures are missing — click Add to enter them">
              ⚠ needs figures
            </span>
          )}
        </div>
      </div>

      {/* Budget / Gross / Profit */}
      <div className="movie-figures">
        <EditField
          label="Budget"
          value={movie.budget}
          missing={released && movie.budget === null}
          onSave={(val) => onBudgetChange(movie.id, val)}
        />
        <EditField
          label="Gross"
          value={movie.gross}
          missing={released && movie.gross === null}
          onSave={(val) => onGrossChange(movie.id, val)}
        />
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

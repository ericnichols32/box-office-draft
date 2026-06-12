import React, { useState, useRef } from 'react';
import type { PredictionBonus } from '../types';

interface Props {
  bonuses: PredictionBonus[];
  onGrossChange: (id: string, field: 'ericPickGross' | 'evanPickGross', val: number | null) => void;
}

function fmtMoney(val: number | null | undefined): string {
  if (val == null) return '—';
  if (val >= 1000) return `$${(val / 1000).toFixed(2)}B`;
  return `$${val.toFixed(0)}M`;
}

interface InlineGrossProps {
  value: number | null | undefined;
  colorClass: string;
  onSave: (val: number | null) => void;
}

const InlineGross: React.FC<InlineGrossProps> = ({ value, colorClass, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(value != null ? String(value) : '');
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
      <input
        ref={inputRef}
        className="bonus-gross-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        placeholder="$M"
      />
    );
  }

  return (
    <span className="bonus-gross-cell" onClick={startEdit}>
      <span className={`bonus-gross-val ${colorClass}`}>{fmtMoney(value)}</span>
      <span className="bonus-pencil">✎</span>
    </span>
  );
};

export const BonusSection: React.FC<Props> = ({ bonuses, onGrossChange }) => {
  return (
    <div className="bonus-section">
      <h3 className="bonus-title">🏆 Prediction Bonuses — $100M Each</h3>
      <div className="bonus-grid">
        {bonuses.map((bonus) => {
          const bothFilled = bonus.ericPickGross != null && bonus.evanPickGross != null;
          const ericWinning = bothFilled && bonus.ericPickGross! > bonus.evanPickGross!;
          const evanWinning = bothFilled && bonus.evanPickGross! > bonus.ericPickGross!;
          const tied = bothFilled && bonus.ericPickGross === bonus.evanPickGross;

          const ericPickColor = !bothFilled ? '' : tied ? '' : ericWinning ? 'gross-winning' : 'gross-losing';
          const evanPickColor = !bothFilled ? '' : tied ? '' : evanWinning ? 'gross-winning' : 'gross-losing';
          const ericNameColor = !bothFilled ? '' : tied ? '' : ericWinning ? 'gross-winning' : 'gross-losing';
          const evanNameColor = !bothFilled ? '' : tied ? '' : evanWinning ? 'gross-winning' : 'gross-losing';

          return (
            <div key={bonus.id} className={`bonus-card winner-${bonus.winner}`}>
              <div className="bonus-label">{bonus.label}</div>

              <div className="bonus-table">
                <div className={`bonus-row ${bonus.winner === 'eric' || bonus.winner === 'both' ? 'pick-winner' : ''}`}>
                  <span className={`bt-player ${ericNameColor}`}>Eric</span>
                  <span className={`bt-pick ${ericPickColor}`}>{bonus.ericPick}</span>
                  <span className="bt-gross-val">
                    <InlineGross
                      value={bonus.ericPickGross}
                      colorClass={ericPickColor}
                      onSave={(val) => onGrossChange(bonus.id, 'ericPickGross', val)}
                    />
                    {(bonus.winner === 'eric' || bonus.winner === 'both') && (
                      <span className="pick-win-badge">+$100M</span>
                    )}
                  </span>
                </div>

                <div className={`bonus-row ${bonus.winner === 'evan' || bonus.winner === 'both' ? 'pick-winner' : ''}`}>
                  <span className={`bt-player ${evanNameColor}`}>Evan</span>
                  <span className={`bt-pick ${evanPickColor}`}>{bonus.evanPick}</span>
                  <span className="bt-gross-val">
                    <InlineGross
                      value={bonus.evanPickGross}
                      colorClass={evanPickColor}
                      onSave={(val) => onGrossChange(bonus.id, 'evanPickGross', val)}
                    />
                    {(bonus.winner === 'evan' || bonus.winner === 'both') && (
                      <span className="pick-win-badge">+$100M</span>
                    )}
                  </span>
                </div>
              </div>

              <div className="bonus-status">
                {bothFilled && ericWinning && <span className="status-gross-winner">Eric wins +$100M</span>}
                {bothFilled && evanWinning && <span className="status-gross-winner">Evan wins +$100M</span>}
                {bothFilled && tied      && <span className="status-split">🤝 SPLIT — Both Win!</span>}
                {!bothFilled && bonus.winner === 'pending' && <span className="status-pending">⏳ PENDING</span>}
                {!bothFilled && bonus.winner === 'eric'    && <span className="status-winner-eric">🏆 Eric Wins!</span>}
                {!bothFilled && bonus.winner === 'evan'    && <span className="status-winner-evan">🏆 Evan Wins!</span>}
                {!bothFilled && bonus.winner === 'both'    && <span className="status-split">🤝 SPLIT — Both Win!</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

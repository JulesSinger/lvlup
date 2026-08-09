import { getRank, RANKS, type Rank, type RankId } from '../lib/ranks';

export function RankBadge({
  rank,
  size = 'sm',
  label,
}: {
  rank: Rank | null;
  size?: 'sm' | 'lg';
  label?: string;
}) {
  if (!rank) {
    return (
      <span className={`rank-badge muted${size === 'lg' ? ' lg' : ''}`}>
        <span className="crest" />
        {label ?? 'Non classé'}
      </span>
    );
  }
  return (
    <span
      className={`rank-badge${size === 'lg' ? ' lg' : ''}`}
      style={{
        background: `linear-gradient(135deg, ${rank.color}2e, ${rank.color2}1f)`,
        color: rank.color2,
        borderColor: `${rank.color}66`,
      }}
    >
      <span
        className="crest"
        style={{ background: `linear-gradient(150deg, ${rank.color2}, ${rank.color})` }}
      />
      {label ?? rank.label}
    </span>
  );
}

export function RankSelect({
  value,
  onChange,
  id,
}: {
  value: RankId;
  onChange: (rank: RankId) => void;
  id?: string;
}) {
  const rank = getRank(value);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as RankId)}
      style={{ color: rank.color2, borderColor: `${rank.color}66` }}
      aria-label="Rang du palier"
    >
      {RANKS.map((r) => (
        <option key={r.id} value={r.id} style={{ color: 'var(--text)' }}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

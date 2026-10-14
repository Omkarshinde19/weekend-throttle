/** Circular 0–100 match score. */
export function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  return (
    <svg className="score-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Match ${score} out of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} className="score-ring__track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="score-ring__value"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
        {score}
      </text>
    </svg>
  );
}

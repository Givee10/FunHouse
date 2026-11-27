
import styles from './Timer.module.css';
export function Timer({ left, total }: { left: number; total: number }) {
  const frac = total > 0 ? Math.min(1, left / total) : 0;
  const color = frac < 0.33 ? '#ff5d6c' : frac < 0.66 ? '#ffb347' : '#3dd68c';
  const circ = 2 * Math.PI * 54;
  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 120 120" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r="54" fill="none" stroke="#2a2f3a" strokeWidth="8" />
        <circle cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - frac)} style={{ transition: 'stroke 0.3s' }} />
      </svg>
      <div className={styles.num} style={{ color }}>{left}</div>
    </div>
  );
}
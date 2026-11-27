
import styles from './Leaderboard.module.css';
export type Row = { id: number; nick: string; correct: number; manual: number; total: number };

export function Leaderboard({ rows, me }: { rows: Row[]; me?: string }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th}>#</th>
          <th className={styles.th}>Игрок</th>
          <th className={styles.th}>Викт.</th>
          <th className={styles.th}>Руч.</th>
          <th className={styles.th}>Всего</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} className={r.nick === me ? styles.me : undefined}>
            <td className={styles.td}>{i + 1}</td>
            <td className={styles.td}>{r.nick}</td>
            <td className={styles.td}>{r.correct}</td>
            <td className={styles.td}>{r.manual}</td>
            <td className={styles.td} style={{ fontWeight: 700 }}>{r.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
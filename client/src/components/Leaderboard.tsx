
export type Row = { id: number; nick: string; correct: number; manual: number; total: number };

export function Leaderboard({ rows, me }: { rows: Row[]; me?: string }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr>
          <th style={{ padding: 8, textAlign: 'left', color: '#8a8f9e', fontSize: 12 }}>#</th>
          <th style={{ padding: 8, textAlign: 'left', color: '#8a8f9e', fontSize: 12 }}>Игрок</th>
          <th style={{ padding: 8, textAlign: 'left', color: '#8a8f9e', fontSize: 12 }}>Викт.</th>
          <th style={{ padding: 8, textAlign: 'left', color: '#8a8f9e', fontSize: 12 }}>Руч.</th>
          <th style={{ padding: 8, textAlign: 'left', color: '#8a8f9e', fontSize: 12 }}>Всего</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} style={{ color: r.nick === me ? '#4f8cff' : undefined, fontWeight: r.nick === me ? 700 : undefined }}>
            <td style={{ padding: 8, borderBottom: '1px solid #2a2f3a' }}>{i + 1}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #2a2f3a' }}>{r.nick}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #2a2f3a' }}>{r.correct}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #2a2f3a' }}>{r.manual}</td>
            <td style={{ padding: 8, borderBottom: '1px solid #2a2f3a', fontWeight: 700 }}>{r.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
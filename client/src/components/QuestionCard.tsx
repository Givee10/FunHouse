
export function QuestionCard({
  text, opts, onAnswer, answered, correct, chosen,
}: {
  text: string;
  opts: string[];
  onAnswer: (i: number) => void;
  answered: boolean;
  correct: number | null;
  chosen: number | null;
}) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 700, margin: '10px 0 12px', lineHeight: 1.3 }}>{text}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
        {opts.map((o, i) => {
          let bg = '#22262f';
          let border = 'transparent';
          if (correct !== null) {
            if (i === correct) { bg = '#3dd68c'; }
            else if (i === chosen) { bg = '#ff5d6c'; }
          } else if (i === chosen) {
            border = '#4f8cff';
          }
          return (
            <button
              key={i}
              disabled={answered || correct !== null}
              onClick={() => onAnswer(i)}
              style={{
                padding: 16, borderRadius: 14, background: bg, color: (correct !== null && i === correct) ? '#06210f' : '#e8eaf0',
                border: `2px solid ${border}`, cursor: answered || correct !== null ? 'not-allowed' : 'pointer',
                textAlign: 'left', fontSize: 16, fontWeight: 500, minHeight: 56, display: 'flex', alignItems: 'center', gap: 10,
                opacity: answered || correct !== null ? 0.85 : 1,
              }}
            >
              <span style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{i + 1}</span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
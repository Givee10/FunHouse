
import styles from './QuestionCard.module.css';
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
      <div className={styles.qtext}>{text}</div>
      <div className={styles.wrap}>
        {opts.map((o, i) => {
          let bg = 'var(--optbg)';
          if (correct !== null) {
            if (i === correct) bg = 'var(--ok)';
            else if (i === chosen) bg = 'var(--bad)';
          }
          const color = correct !== null && i === correct ? '#06210f' : 'var(--text)';
          const border = (correct === null && i === chosen) ? 'var(--accent)' : 'transparent';
          return (
            <button
              key={i}
              disabled={answered || correct !== null}
              onClick={() => onAnswer(i)}
              className={styles.btn}
              style={{ background: bg, color, borderColor: border, opacity: answered || correct !== null ? 0.85 : 1 }}
            >
              <span className={styles.idx}>{i + 1}</span>
              <span>{o}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useTimer } from '../hooks/useTimer';

import { Leaderboard } from '../components/Leaderboard';
import type { Row } from '../components/Leaderboard';

export default function Board() {
  const { socket, connected } = useSocket();
  const [pin, setPin] = useState('');

  const [question, setQuestion] = useState<{ text: string; opts: string[]; time: number; endsAt: number; serverTime: number; index: number; total: number } | null>(null);
  const [correct, setCorrect] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState('');
  const [answerProgress, setAnswerProgress] = useState('');
  const [finished, setFinished] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [roundResults, setRoundResults] = useState<{ nick: string; choice: number | null; correct: boolean }[]>([]);

  const left = useTimer(question?.endsAt ?? null, question?.serverTime ?? null);

  useEffect(() => {
    const t = localStorage.getItem('fh_theme') || 'dark';
    setTheme(t as 'dark' | 'light');
    document.body.className = t;
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onQ = (d: any) => {
      setQuestion(d);
      setCorrect(null);
      setRoundResults([]);
      setAnswerProgress('');
      setProgress(`Вопрос ${d.index} из ${d.total}`);
      setFinished(false);
    };
    const onReveal = (d: any) => {
      setCorrect(d.correct);
      if (d.players) setRoundResults(d.players);
    };
    const onFinished = () => { setFinished(true); setQuestion(null); setProgress('Финиш'); };
    const onBoard = (r: Row[]) => setRows(r);
    const onAP = (d: any) => setAnswerProgress(`Ответили: ${d.answered} из ${d.total}`);
    socket.on('question_open', onQ);
    socket.on('reveal', onReveal);
    socket.on('finished', onFinished);
    socket.on('leaderboard', onBoard);
    socket.on('answer_progress', onAP);
    return () => {
      socket.off('question_open', onQ);
      socket.off('reveal', onReveal);
      socket.off('finished', onFinished);
      socket.off('leaderboard', onBoard);
      socket.off('answer_progress', onAP);
    };
  }, [socket]);

  const connect = () => {
    if (!pin) return;
    socket?.emit('join_board', { pin });
  };

  const toggleTheme = () => {
    const t = theme === 'dark' ? 'light' : 'dark';
    setTheme(t);
    localStorage.setItem('fh_theme', t);
    document.body.className = t;
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 36, margin: 0 }}>Табло</h1>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 999, background: '#22262f', fontSize: 14, color: '#8a8f9e' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: connected ? '#3dd68c' : '#ff5d6c' }} />
          {connected ? 'онлайн' : 'нет связи'}
        </span>
        <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN игры" style={{ flex: 1, minWidth: 160, padding: 12, borderRadius: 12, border: '1px solid #2a2f3a', background: '#141820', color: '#f2f4fa', fontSize: 16 }} />
        <button onClick={toggleTheme} style={{ padding: '12px 16px', borderRadius: 12, border: 0, background: '#22262f', color: '#f2f4fa', cursor: 'pointer' }}>{theme === 'dark' ? '🌙' : '☀️'}</button>
        <button onClick={connect} style={{ padding: '12px 16px', borderRadius: 12, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Подключить</button>
      </div>

      <div style={{ background: '#141820', borderRadius: 20, padding: 24, marginBottom: 16 }}>
        <div style={{ textAlign: 'center', color: '#8a8f9e', fontSize: 16, marginBottom: 8 }}>{progress}</div>
        {!finished && <div style={{ fontSize: 96, fontWeight: 900, textAlign: 'center', margin: '8px 0', lineHeight: 1, color: left < (question?.time ?? 0) * 0.33 ? '#ff5d6c' : left < (question?.time ?? 0) * 0.66 ? '#ffb347' : '#3dd68c' }}>{left}</div>}
        <div style={{ fontSize: 30, fontWeight: 700, textAlign: 'center', margin: '12px 0', lineHeight: 1.2 }}>{finished ? 'Игра завершена' : (question?.text ?? 'Подключитесь к игре')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 1000, margin: '16px auto 0' }}>
          {(question?.opts ?? []).map((o, i) => (
            <div key={i} style={{ padding: 20, borderRadius: 14, background: correct === i ? '#3dd68c' : '#1e222c', color: correct === i ? '#06210f' : '#f2f4fa', textAlign: 'center', fontSize: 22, fontWeight: correct === i ? 700 : 400, border: '2px solid transparent' }}>
              <b>{i + 1}.</b> {o}
            </div>
          ))}
        </div>
        {roundResults.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>Результаты раунда</h3>
            {roundResults.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #2a2f3a' }}>
                <span>{p.nick}</span>
                <span style={{ fontWeight: 700, color: p.correct ? '#3dd68c' : p.choice === null ? '#8a8f9e' : '#ff5d6c' }}>
                  {p.correct ? '✓' : p.choice === null ? '—' : '✗'} {p.choice === null ? 'не ответил' : p.choice + 1}
                </span>
              </div>
            ))}
          </div>
        )}
        <div style={{ color: '#8a8f9e', fontSize: 13, textAlign: 'center', marginTop: 8 }}>{answerProgress}</div>
      </div>

      <div style={{ background: '#141820', borderRadius: 20, padding: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 22 }}>Рейтинг</h2>
        <Leaderboard rows={rows} />
      </div>
    </div>
  );
}
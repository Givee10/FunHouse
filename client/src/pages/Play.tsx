import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useTimer } from '../hooks/useTimer';
import { Timer } from '../components/Timer';
import { QuestionCard } from '../components/QuestionCard';
import { Leaderboard } from '../components/Leaderboard';
import type { Row } from '../components/Leaderboard';

export default function Play() {
  const { socket, connected } = useSocket();
  const [pin, setPin] = useState('');
  const [nick, setNick] = useState('');
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [myNick, setMyNick] = useState('');
  const [inGame, setInGame] = useState(false);
  const [question, setQuestion] = useState<{ id: number; text: string; opts: string[]; time: number; endsAt: number; serverTime: number; index: number; total: number } | null>(null);
  const [correct, setCorrect] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [progress, setProgress] = useState('');
  const [answerProgress, setAnswerProgress] = useState('');
  const [finished, setFinished] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const left = useTimer(question?.endsAt ?? null, question?.serverTime ?? null);

  useEffect(() => {
    const t = localStorage.getItem('fh_theme') || 'dark';
    setTheme(t as 'dark' | 'light');
    document.body.className = t;
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onJoined = (d: any) => {
      setPlayerId(d.playerId);
      setMyNick(d.nick);
      setInGame(true);
      localStorage.setItem('fh_session', JSON.stringify({ pin, nick: d.nick, playerId: d.playerId }));
    };
    const onErr = (d: any) => {
      const el = document.getElementById('joinErr');
      if (el) el.textContent = d.msg;
      if (d.msg?.includes('ник уже')) localStorage.removeItem('fh_session');
    };
    const onQ = (d: any) => {
      setQuestion(d);
      setCorrect(null);
      setChosen(null);
      setAnswered(false);
      setFeedback('');
      setAnswerProgress('');
      setFinished(false);
      setProgress(`Вопрос ${d.index} из ${d.total}`);
    };
    const onReveal = (d: any) => {
      setCorrect(d.correct);
      const chosenIdx = chosen;
      if (chosenIdx === null) setFeedback('Время вышло');
      else if (chosenIdx === d.correct) setFeedback('Верно! ✓');
      else setFeedback('Неверно ✗');
    };
    const onFinished = () => {
      setFinished(true);
      setQuestion(null);
      setFeedback('');
      setAnswerProgress('');
      setProgress('Финиш');
    };
    const onStopped = () => { setFeedback('Игра остановлена'); };
    const onBoard = (r: Row[]) => setRows(r);
    const onAP = (d: any) => setAnswerProgress(`Ответили: ${d.answered} из ${d.total}`);

    socket.on('joined', onJoined);
    socket.on('error', onErr);
    socket.on('question_open', onQ);
    socket.on('reveal', onReveal);
    socket.on('finished', onFinished);
    socket.on('stopped', onStopped);
    socket.on('leaderboard', onBoard);
    socket.on('answer_progress', onAP);

    // auto-rejoin on connect
    const onConnect = () => {
      try {
        const s = JSON.parse(localStorage.getItem('fh_session') || 'null');
        if (s && s.pin && s.nick) {
          setPin(s.pin); setNick(s.nick);
          socket.emit('join_game', { pin: s.pin, nick: s.nick });
        }
      } catch {}
    };
    socket.on('connect', onConnect);

    return () => {
      socket.off('joined', onJoined);
      socket.off('error', onErr);
      socket.off('question_open', onQ);
      socket.off('reveal', onReveal);
      socket.off('finished', onFinished);
      socket.off('stopped', onStopped);
      socket.off('leaderboard', onBoard);
      socket.off('answer_progress', onAP);
      socket.off('connect', onConnect);
    };
  }, [socket, chosen, pin]);

  useEffect(() => {
    // restore session on mount
    try {
      const s = JSON.parse(localStorage.getItem('fh_session') || 'null');
      if (s && s.pin && s.nick) {
        setPin(s.pin); setNick(s.nick);
      }
    } catch {}
  }, []);

  const join = () => {
    if (!pin || !nick) return;
    socket?.emit('join_game', { pin, nick });
  };

  const answer = (i: number) => {
    if (answered || correct !== null || !question) return;
    setAnswered(true);
    setChosen(i);
    socket?.emit('answer', { pin, playerId, questionId: question.id, choice: i });
    setFeedback('Ответ принят. Ждём результат...');
  };

  const logout = () => {
    localStorage.removeItem('fh_session');
    setInGame(false);
    setPlayerId(null);
    setQuestion(null);
  };

  const toggleTheme = () => {
    const t = theme === 'dark' ? 'light' : 'dark';
    setTheme(t);
    localStorage.setItem('fh_theme', t);
    document.body.className = t;
  };

  if (!inGame) {
    return (
      <div style={{ maxWidth: 520, margin: '0 auto', padding: 16 }}>
        <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16 }}>
          <h1 style={{ fontSize: 24, margin: '0 0 6px', textAlign: 'center' }}>Викторина</h1>
          <p style={{ color: '#8a8f9e', fontSize: 14, textAlign: 'center', marginBottom: 12 }}>Введи PIN игры и свой ник</p>
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN игры" style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', fontSize: 16, marginBottom: 8 }} />
          <input value={nick} onChange={e => setNick(e.target.value)} placeholder="Твой ник" maxLength={20} style={{ width: '100%', padding: 14, borderRadius: 12, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', fontSize: 16, marginBottom: 12 }} />
          <button onClick={join} style={{ width: '100%', padding: 14, borderRadius: 12, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Войти</button>
          <div id="joinErr" style={{ marginTop: 8, color: '#ff5d6c', fontSize: 14 }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={logout} style={{ padding: '6px 12px', fontSize: 13, background: '#22262f', color: '#e8eaf0', border: 0, borderRadius: 999, cursor: 'pointer' }}>Выйти</button>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={toggleTheme} style={{ padding: '6px 10px', fontSize: 13, background: '#22262f', color: '#e8eaf0', border: 0, borderRadius: 999, cursor: 'pointer' }}>{theme === 'dark' ? '🌙' : '☀️'}</button>
          <button onClick={() => setSoundOn(s => !s)} style={{ padding: '6px 10px', fontSize: 13, background: '#22262f', color: '#e8eaf0', border: 0, borderRadius: 999, cursor: 'pointer' }}>{soundOn ? '🔊' : '🔇'}</button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: '#22262f', fontSize: 13, color: '#8a8f9e' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#3dd68c' : '#ff5d6c' }} />
            {connected ? 'онлайн' : 'нет связи'}
          </span>
        </div>
      </div>

      <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, textAlign: 'center' }}>
        <div style={{ color: '#8a8f9e', fontSize: 13, marginBottom: 4, fontWeight: 600 }}>{myNick}</div>
        <div style={{ color: '#8a8f9e', fontSize: 13, marginBottom: 8 }}>{progress}</div>
        {!finished && <Timer left={left} total={question?.time ?? 0} />}
        <QuestionCard
          text={finished ? 'Игра завершена!' : (question?.text ?? 'Ожидаем вопрос...')}
          opts={question?.opts ?? []}
          onAnswer={answer}
          answered={answered}
          correct={correct}
          chosen={chosen}
        />
        <div style={{ marginTop: 12, textAlign: 'center', fontSize: 15, minHeight: 20, color: feedback.includes('Верно') ? '#3dd68c' : feedback.includes('Неверно') || feedback.includes('Время') ? '#ff5d6c' : '#8a8f9e', fontWeight: 700 }}>
          {feedback}
        </div>
        <div style={{ color: '#8a8f9e', fontSize: 13, marginTop: 4, textAlign: 'center' }}>{answerProgress}</div>
      </div>

      <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, marginTop: 12 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>Таблица результатов</h2>
        <Leaderboard rows={rows} me={myNick} />
      </div>
    </div>
  );
}
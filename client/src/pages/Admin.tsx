import { useEffect, useState } from 'react';
import { useSocket } from '../hooks/useSocket';

export default function Admin() {
  const { socket, connected } = useSocket();
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);

  const [tab, setTab] = useState('games');
  const [games, setGames] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState('date');
  const [pin, setPin] = useState('');
  const [ctrlPin, setCtrlPin] = useState('');
  const [status, setStatus] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [newQ, setNewQ] = useState({ text: '', opts: ['', '', '', ''], correct: 0, time: 20 });
  const [players, setPlayers] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [manual, setManual] = useState({ playerId: '', contest: 'Живой конкурс', points: 0, comment: '' });
  const [manualList, setManualList] = useState<any[]>([]);

  const api = (path: string, opts: any = {}) => fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });

  const login = async () => {
    const r = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
    const d = await r.json();
    if (d.ok) { setAuthed(true); loadGames(); }
    else alert('Неверный пароль');
  };

  const loadGames = async () => {
    const r = await api('/api/games');
    if (r.ok) setGames(await r.json());
  };

  const createGame = async () => {
    const r = await api('/api/games', { method: 'POST', body: JSON.stringify({}) });
    const d = await r.json();
    if (d.ok) { alert('PIN: ' + d.pin); loadGames(); }
  };

  const selectPin = (p: string) => {
    setPin(p); setCtrlPin(p);
    loadQuestions(p); loadPlayers(p); loadBoard(p); loadManualList(p);
  };

  const loadQuestions = async (p = pin) => {
    if (!p) return;
    const r = await api('/api/games/' + p);
    const d = await r.json();
    setQuestions(d.questions || []);
  };

  const addQuestion = async () => {
    const r = await api('/api/questions', { method: 'POST', body: JSON.stringify({ pin, text: newQ.text, opts: newQ.opts, correct: newQ.correct, time: newQ.time }) });
    const d = await r.json();
    if (d.ok) { setNewQ({ text: '', opts: ['', '', '', ''], correct: 0, time: 20 }); loadQuestions(); }
    else alert(d.error);
  };

  const seedGeo = async () => {
    const r = await api('/api/seed-geo', { method: 'POST', body: JSON.stringify({ pin }) });
    const d = await r.json();
    if (d.ok) { alert('Добавлено: ' + d.added); loadQuestions(); }
  };

  const delQuestion = async (id: number) => {
    await api('/api/questions/' + id, { method: 'DELETE' });
    loadQuestions();
  };

  const joinAdminRoom = () => {
    socket?.emit('admin_join', { password });
  };

  useEffect(() => {
    if (!socket) return;
    const onOk = () => { socket.emit('join_room_admin', { pin: ctrlPin }); };
    const onState = (d: any) => setStatus(`Статус: ${d.status} | вопрос ${d.current}/${d.total}`);
    const onAP = (d: any) => setStatus(s => s + ` | ответили ${d.answered}/${d.total}`);
    socket.on('admin_ok', onOk);
    socket.on('state', onState);
    socket.on('answer_progress', onAP);
    return () => { socket.off('admin_ok', onOk); socket.off('state', onState); socket.off('answer_progress', onAP); };
  }, [socket, ctrlPin]);

  const act = (ev: string) => { if (!ctrlPin) return alert('Подключись к игре'); socket?.emit(ev, { pin: ctrlPin }); };

  const loadPlayers = async (p = pin) => {
    if (!p) return;
    const r = await api('/api/games/' + p);
    const d = await r.json();
    setPlayers(d.players || []);
  };

  const kick = async (id: number) => {
    if (!confirm('Исключить игрока?')) return;
    await api('/api/players/' + id, { method: 'DELETE' });
    loadPlayers();
  };

  const loadBoard = async (p = pin) => {
    if (!p) return;
    const r = await api('/api/games/' + p);
    const d = await r.json();
    setLeaderboard(d.leaderboard || []);
  };

  const loadManualList = async (p = pin) => {
    if (!p) return;
    const r = await api('/api/manual/' + p);
    if (r.ok) setManualList(await r.json());
  };

  const addManual = async () => {
    const r = await api('/api/manual', { method: 'POST', body: JSON.stringify({ pin, playerId: manual.playerId, contest: manual.contest, points: manual.points, comment: manual.comment }) });
    const d = await r.json();
    if (d.ok) { loadManualList(); loadBoard(); }
    else alert(d.error);
  };

  const delManual = async (id: number) => {
    await api('/api/manual/' + id, { method: 'DELETE' });
    loadManualList(); loadBoard();
  };

  if (!authed) {
    return (
      <div style={{ maxWidth: 400, margin: '40px auto', background: '#1a1d24', borderRadius: 16, padding: 16 }}>
        <h1>Вход админа</h1>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
        <button onClick={login} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Войти</button>
      </div>
    );
  }

  const tabs = ['games', 'control', 'questions', 'players', 'manual', 'board', 'history'];
  const tabNames: Record<string, string> = { games: 'Игры', control: 'Управление', questions: 'Вопросы', players: 'Игроки', manual: 'Ручные баллы', board: 'Рейтинг', history: 'История' };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Админ-пульт</h1>
          <span style={{ color: connected ? '#3dd68c' : '#ff5d6c', fontSize: 13 }}>{connected ? 'онлайн' : 'нет связи'}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 14px', borderRadius: 8, border: 0, background: tab === t ? '#4f8cff' : '#2a2f3a', color: '#fff', cursor: 'pointer' }}>{tabNames[t]}</button>
          ))}
        </div>
      </div>

      {tab === 'games' && (
        <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <h2>Создать игру</h2>
          <button onClick={createGame} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Создать</button>
          <h2 style={{ marginTop: 16 }}>Игры</h2>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0' }}>
              <option value="all">Все статусы</option>
              <option value="lobby">lobby</option>
              <option value="open">open</option>
              <option value="reveal">reveal</option>
              <option value="finished">finished</option>
            </select>
            <select value={sortKey} onChange={e => setSortKey(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0' }}>
              <option value="date">По дате</option>
              <option value="pin">По PIN</option>
              <option value="status">По статусу</option>
            </select>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr><th style={{ padding: 8, textAlign: 'left' }}>PIN</th><th style={{ padding: 8, textAlign: 'left' }}>Статус</th><th style={{ padding: 8, textAlign: 'left' }}></th></tr></thead>
            <tbody>
              {games
                .filter(g => filterStatus === 'all' || g.status === filterStatus)
                .sort((a, b) => sortKey === 'pin' ? a.pin.localeCompare(b.pin) : sortKey === 'status' ? a.status.localeCompare(b.status) : b.created_at - a.created_at)
                .map(g => (
                <tr key={g.id}><td style={{ padding: 8 }}><b>{g.pin}</b></td><td style={{ padding: 8 }}>{g.status}</td><td style={{ padding: 8 }}><button onClick={() => selectPin(g.pin)} style={{ padding: '6px 10px', borderRadius: 6, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer' }}>Выбрать</button></td></tr>
              ))}
            </tbody>
          </table>
          <button onClick={loadGames} style={{ marginTop: 8, padding: '10px 14px', borderRadius: 8, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer' }}>Обновить</button>
        </div>
      )}

      {tab === 'control' && (
        <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <h2>Управление игрой</h2>
          <input value={ctrlPin} onChange={e => setCtrlPin(e.target.value)} placeholder="PIN игры" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button onClick={joinAdminRoom} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer' }}>Подключить</button>
            <button onClick={() => act('admin_start')} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Старт</button>
            <button onClick={() => act('admin_next')} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Следующий</button>
            <button onClick={() => act('admin_reveal')} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Показать ответ</button>
            <button onClick={() => act('admin_stop')} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#ff5d6c', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Стоп</button>
          </div>
          <div style={{ marginTop: 8, color: '#8a8f9e', fontSize: 14 }}>{status}</div>
        </div>
      )}

      {tab === 'questions' && (
        <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <h2>Добавить вопрос</h2>
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN игры" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          <textarea value={newQ.text} onChange={e => setNewQ({ ...newQ, text: e.target.value })} placeholder="Текст вопроса" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          {newQ.opts.map((o, i) => (
            <input key={i} value={o} onChange={e => { const opts = [...newQ.opts]; opts[i] = e.target.value; setNewQ({ ...newQ, opts }); }} placeholder={`Вариант ${i + 1}`} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          ))}
          <div style={{ display: 'flex', gap: 8, margin: '4px 0' }}>
            <select value={newQ.correct} onChange={e => setNewQ({ ...newQ, correct: Number(e.target.value) })} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0' }}>
              {[0,1,2,3].map(i => <option key={i} value={i}>Правильный: {i+1}</option>)}
            </select>
            <input type="number" value={newQ.time} onChange={e => setNewQ({ ...newQ, time: Number(e.target.value) })} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0' }} />
          </div>
          <button onClick={addQuestion} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Добавить</button>
          <button onClick={seedGeo} style={{ marginLeft: 8, padding: '10px 14px', borderRadius: 8, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer' }}>Загрузить географию</button>
          <h2 style={{ marginTop: 16 }}>Вопросы</h2>
          <button onClick={() => loadQuestions()} style={{ padding: '6px 10px', borderRadius: 6, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer', marginBottom: 8 }}>Обновить</button>
          {questions.map(q => (
            <div key={q.id} style={{ background: '#22262f', borderRadius: 10, padding: 10, margin: '8px 0' }}>
              <b>{q.text}</b><br />
              <span style={{ color: '#8a8f9e', fontSize: 13 }}>1) {q.opt1} 2) {q.opt2} 3) {q.opt3} 4) {q.opt4} | правильный: {q.correct + 1} | {q.time_limit}s</span>
              <button onClick={() => delQuestion(q.id)} style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 6, border: 0, background: '#ff5d6c', color: '#fff', cursor: 'pointer', fontSize: 12 }}>Удалить</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'players' && (
        <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <h2>Игроки</h2>
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN игры" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          <button onClick={() => loadPlayers()} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer' }}>Обновить</button>
          <div style={{ marginTop: 8 }}>
            {players.map(p => (
              <div key={p.id} style={{ background: '#22262f', borderRadius: 10, padding: 10, margin: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {p.nick}
                <button onClick={() => kick(p.id)} style={{ padding: '4px 8px', borderRadius: 6, border: 0, background: '#ff5d6c', color: '#fff', cursor: 'pointer', fontSize: 12 }}>Исключить</button>
              </div>
            ))}
            {!players.length && <div style={{ color: '#8a8f9e' }}>Нет игроков</div>}
          </div>
        </div>
      )}

      {tab === 'manual' && (
        <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <h2>Внести ручные баллы</h2>
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN игры" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          <select value={manual.playerId} onChange={e => setManual({ ...manual, playerId: e.target.value })} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }}>
            <option value="">Выбери игрока</option>
            {players.map(p => <option key={p.id} value={p.id}>{p.nick}</option>)}
          </select>
          <input value={manual.contest} onChange={e => setManual({ ...manual, contest: e.target.value })} placeholder="Конкурс" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          <input type="number" value={manual.points} onChange={e => setManual({ ...manual, points: Number(e.target.value) })} placeholder="Баллы" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          <input value={manual.comment} onChange={e => setManual({ ...manual, comment: e.target.value })} placeholder="Комментарий" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          <button onClick={addManual} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#4f8cff', color: '#fff', fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>Добавить</button>
          <button onClick={() => loadPlayers()} style={{ marginLeft: 8, padding: '10px 14px', borderRadius: 8, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer', marginTop: 8 }}>Обновить игроков</button>
          <h2 style={{ marginTop: 16 }}>Ручные баллы</h2>
          <button onClick={() => loadManualList()} style={{ padding: '6px 10px', borderRadius: 6, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer', marginBottom: 8 }}>Обновить</button>
          {manualList.map(m => (
            <div key={m.id} style={{ background: '#22262f', borderRadius: 10, padding: 10, margin: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {m.nick}: <b>{m.points}</b> ({m.contest}) {m.comment}
              <button onClick={() => delManual(m.id)} style={{ padding: '4px 8px', borderRadius: 6, border: 0, background: '#ff5d6c', color: '#fff', cursor: 'pointer', fontSize: 12 }}>Удалить</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'board' && (
        <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <h2>Рейтинг</h2>
          <input value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN игры" style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #2a2f3a', background: '#0f1115', color: '#e8eaf0', margin: '4px 0' }} />
          <button onClick={() => loadBoard()} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer' }}>Обновить</button>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginTop: 8 }}>
            <thead><tr><th style={{ padding: 8, textAlign: 'left' }}>#</th><th style={{ padding: 8, textAlign: 'left' }}>Игрок</th><th style={{ padding: 8, textAlign: 'left' }}>Викт.</th><th style={{ padding: 8, textAlign: 'left' }}>Руч.</th><th style={{ padding: 8, textAlign: 'left' }}>Всего</th></tr></thead>
            <tbody>
              {leaderboard.map((r, i) => (
                <tr key={r.id}><td style={{ padding: 8 }}>{i + 1}</td><td style={{ padding: 8 }}>{r.nick}</td><td style={{ padding: 8 }}>{r.correct}</td><td style={{ padding: 8 }}>{r.manual}</td><td style={{ padding: 8, fontWeight: 700 }}>{r.total}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div style={{ background: '#1a1d24', borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <h2>История игр</h2>
          <button onClick={async () => { const r = await api('/api/games'); if (r.ok) setGames(await r.json()); }} style={{ padding: '10px 14px', borderRadius: 8, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer' }}>Обновить</button>
          <button onClick={() => window.open('/api/backup', '_blank')} style={{ marginLeft: 8, padding: '10px 14px', borderRadius: 8, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer' }}>Скачать бэкап БД</button>
          <div style={{ marginTop: 12 }}>
            {games.map(g => (
              <div key={g.id} style={{ background: '#22262f', borderRadius: 10, padding: 10, margin: '8px 0' }}>
                <b>PIN {g.pin}</b> — {g.status} — {new Date(g.created_at).toLocaleString()}
                <div style={{ marginTop: 6 }}>
                  <button onClick={() => window.open('/api/export/' + g.pin, '_blank')} style={{ padding: '4px 8px', borderRadius: 6, border: 0, background: '#2a2f3a', color: '#fff', cursor: 'pointer', fontSize: 12 }}>Экспорт CSV</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const db = require('./db');

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const ADMIN_TOKENS = new Set();

function genToken() { return crypto.randomBytes(24).toString('hex'); }
function isAdminReq(req) { return ADMIN_TOKENS.has(req.cookies && req.cookies.admin_token); }

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(cookieParser());
app.use(express.static('client/dist'));
app.use(express.static('public'));
// SPA fallback
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return res.status(404).end();
  res.sendFile('index.html', { root: 'client/dist' });
});

// ---------- helpers ----------
function getGameByPin(pin) {
  return db.prepare('SELECT * FROM games WHERE pin = ?').get(pin);
}
function questionsFor(gameId) {
  return db.prepare('SELECT * FROM questions WHERE game_id = ? ORDER BY order_idx, id').all(gameId);
}
function playersFor(gameId) {
  return db.prepare('SELECT * FROM players WHERE game_id = ? ORDER BY id').all(gameId);
}
function leaderboard(gameId) {
  const rows = db.prepare(`
    SELECT p.id, p.nick,
      COALESCE((SELECT SUM(CASE WHEN a.is_correct=1 THEN 1 ELSE 0 END) FROM answers a WHERE a.player_id=p.id),0) AS correct,
      COALESCE((SELECT SUM(ms.points) FROM manual_scores ms WHERE ms.player_id=p.id),0) AS manual
    FROM players p WHERE p.game_id=? ORDER BY (correct+manual) DESC, p.id
  `).all(gameId);
  return rows.map(r => ({ ...r, total: r.correct + r.manual }));
}
function emitLeaderboard(pin) {
  const g = getGameByPin(pin);
  if (!g) return;
  io.to('game:' + pin).emit('leaderboard', leaderboard(g.id));
  io.to('admin:' + pin).emit('leaderboard', leaderboard(g.id));
}
function emitState(pin) {
  const g = getGameByPin(pin);
  if (!g) return;
  const qs = questionsFor(g.id);
  const cur = qs[g.current_q - 1] || null;
  const payload = { status: g.status, current: g.current_q, total: qs.length };
  io.to('game:' + pin).emit('state', payload);
  io.to('admin:' + pin).emit('state', { ...payload, question: cur });
}

const timers = new Map(); // pin -> timeout
const activePlayers = new Map(); // playerId -> socket.id
function clearTimer(pin) { if (timers.has(pin)) { clearTimeout(timers.get(pin)); timers.delete(pin); } }

function openQuestion(pin) {
  const g = getGameByPin(pin);
  if (!g) return;
  const qs = questionsFor(g.id);
  const q = qs[g.current_q - 1];
  if (!q) { finishGame(pin); return; }
  const endsAt = Date.now() + q.time_limit * 1000;
  const idx = g.current_q;
  const total = qs.length;
  db.prepare('UPDATE games SET status=?, ends_at=? WHERE id=?').run('open', endsAt, g.id);
  io.to('game:' + pin).emit('question_open', {
    id: q.id, text: q.text, opts: [q.opt1, q.opt2, q.opt3, q.opt4], time: q.time_limit, endsAt, index: idx, total, serverTime: Date.now()
  });
  io.to('admin:' + pin).emit('question_open', {
    id: q.id, text: q.text, opts: [q.opt1, q.opt2, q.opt3, q.opt4], time: q.time_limit, endsAt, correct: q.correct, index: idx, total, serverTime: Date.now()
  });
  clearTimer(pin);
  timers.set(pin, setTimeout(() => revealAnswer(pin), q.time_limit * 1000));
  emitState(pin);
}

function revealAnswer(pin) {
  const g = getGameByPin(pin);
  if (!g) return;
  if (g.status === 'reveal' || g.status === 'finished') return; // avoid duplicate
  clearTimer(pin);
  const qs = questionsFor(g.id);
  const q = qs[g.current_q - 1];
  if (!q) return;
  db.prepare('UPDATE games SET status=? WHERE id=?').run('reveal', g.id);
  const results = db.prepare(`
    SELECT p.nick, a.choice, a.is_correct FROM players p
    LEFT JOIN answers a ON a.player_id=p.id AND a.question_id=?
    WHERE p.game_id=? ORDER BY p.id
  `).all(q.id, g.id).map(r => ({
    nick: r.nick, choice: (r.choice === null || r.choice === undefined) ? null : r.choice, correct: r.is_correct === 1
  }));
  io.to('game:' + pin).emit('reveal', { correct: q.correct, players: results });
  io.to('admin:' + pin).emit('reveal', { correct: q.correct, players: results });
  emitLeaderboard(pin);
  emitState(pin);
}

function finishGame(pin) {
  clearTimer(pin);
  const g = getGameByPin(pin);
  if (!g) return;
  db.prepare('UPDATE games SET status=? WHERE id=?').run('finished', g.id);
  io.to('game:' + pin).emit('finished', {});
  io.to('admin:' + pin).emit('finished', {});
  emitLeaderboard(pin);
  emitState(pin);
}

// ---------- REST ----------
app.post('/api/admin/login', (req, res) => {
  if (req.body && req.body.password === ADMIN_PASSWORD) {
    const t = genToken();
    ADMIN_TOKENS.add(t);
    res.cookie('admin_token', t, { httpOnly: true, sameSite: 'lax' });
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

app.post('/api/admin/logout', (req, res) => {
  if (req.cookies && req.cookies.admin_token) ADMIN_TOKENS.delete(req.cookies.admin_token);
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

function requireAdmin(req, res, next) {
  if (!isAdminReq(req)) return res.status(401).json({ ok: false, error: 'admin only' });
  next();
}

app.get('/api/games', requireAdmin, (req, res) => {
  const games = db.prepare('SELECT * FROM games ORDER BY id DESC').all();
  res.json(games);
});

app.post('/api/games', requireAdmin, (req, res) => {
  const pin = (req.body && req.body.pin) || String(Math.floor(1000 + Math.random() * 9000));
  const exists = getGameByPin(pin);
  if (exists) return res.status(400).json({ ok: false, error: 'pin exists' });
  const info = db.prepare('INSERT INTO games (pin, created_at) VALUES (?,?)').run(pin, Date.now());
  // seed sample questions
  const samples = [
    { text: 'Столица Франции?', opts: ['Лондон', 'Берлин', 'Париж', 'Мадрид'], correct: 2, t: 20 },
    { text: 'Самая длинная река в мире?', opts: ['Амазонка', 'Нил', 'Янцзы', 'Миссисипи'], correct: 1, t: 20 },
    { text: 'Какая страна самая большая по площади?', opts: ['Канада', 'Китай', 'США', 'Россия'], correct: 3, t: 20 },
    { text: 'Столица Японии?', opts: ['Осака', 'Токио', 'Киото', 'Сеул'], correct: 1, t: 15 },
    { text: 'На каком континенте находится Египет?', opts: ['Азия', 'Европа', 'Африка', 'Австралия'], correct: 2, t: 15 },
    { text: 'Самая высокая гора в мире?', opts: ['К2', 'Эверест', 'Килиманджаро', 'Эльбрус'], correct: 1, t: 20 },
    { text: 'Какой океан самый большой?', opts: ['Атлантический', 'Индийский', 'Северный Ледовитый', 'Тихий'], correct: 3, t: 20 },
    { text: 'Столица Австралии?', opts: ['Сидней', 'Мельбурн', 'Канберра', 'Перт'], correct: 2, t: 20 },
    { text: 'Самое глубокое озеро в мире?', opts: ['Каспийское', 'Байкал', 'Танганьика', 'Виктория'], correct: 1, t: 20 },
    { text: 'В какой стране находится водопад Виктория?', opts: ['Бразилия', 'Замбия/Зимбабве', 'Индия', 'Канада'], correct: 1, t: 20 },
  ];
  const ins = db.prepare('INSERT INTO questions (game_id,text,opt1,opt2,opt3,opt4,correct,time_limit,order_idx) VALUES (?,?,?,?,?,?,?,?,?)');
  samples.forEach((s, i) => ins.run(info.lastInsertRowid, s.text, s.opts[0], s.opts[1], s.opts[2], s.opts[3], s.correct, s.t, i));
  res.json({ ok: true, pin, id: info.lastInsertRowid });
});

app.get('/api/games/:pin', (req, res) => {
  const g = getGameByPin(req.params.pin);
  if (!g) return res.status(404).json({ ok: false });
  res.json({ game: g, questions: questionsFor(g.id), players: playersFor(g.id), leaderboard: leaderboard(g.id) });
});

app.post('/api/questions', requireAdmin, (req, res) => {
  const { pin, text, opts, correct, time } = req.body || {};
  const g = getGameByPin(pin);
  if (!g) return res.status(404).json({ ok: false });
  if (!text || !Array.isArray(opts) || opts.length !== 4) return res.status(400).json({ ok: false });
  const n = db.prepare('SELECT COUNT(*) c FROM questions WHERE game_id=?').get(g.id).c;
  db.prepare('INSERT INTO questions (game_id,text,opt1,opt2,opt3,opt4,correct,time_limit,order_idx) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(g.id, text, opts[0], opts[1], opts[2], opts[3], Number(correct), Number(time) || 20, n);
  res.json({ ok: true });
});

app.delete('/api/questions/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM questions WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

const GEO_QUESTIONS = [
  { text: 'Столица Франции?', opts: ['Лондон', 'Берлин', 'Париж', 'Мадрид'], correct: 2, t: 20 },
  { text: 'Самая длинная река в мире?', opts: ['Амазонка', 'Нил', 'Янцзы', 'Миссисипи'], correct: 1, t: 20 },
  { text: 'Какая страна самая большая по площади?', opts: ['Канада', 'Китай', 'США', 'Россия'], correct: 3, t: 20 },
  { text: 'Столица Японии?', opts: ['Осака', 'Токио', 'Киото', 'Сеул'], correct: 1, t: 15 },
  { text: 'На каком континенте находится Египет?', opts: ['Азия', 'Европа', 'Африка', 'Австралия'], correct: 2, t: 15 },
  { text: 'Самая высокая гора в мире?', opts: ['К2', 'Эверест', 'Килиманджаро', 'Эльбрус'], correct: 1, t: 20 },
  { text: 'Какой океан самый большой?', opts: ['Атлантический', 'Индийский', 'Северный Ледовитый', 'Тихий'], correct: 3, t: 20 },
  { text: 'Столица Австралии?', opts: ['Сидней', 'Мельбурн', 'Канберра', 'Перт'], correct: 2, t: 20 },
  { text: 'Самое глубокое озеро в мире?', opts: ['Каспийское', 'Байкал', 'Танганьика', 'Виктория'], correct: 1, t: 20 },
  { text: 'В какой стране находится водопад Виктория?', opts: ['Бразилия', 'Замбия/Зимбабве', 'Индия', 'Канада'], correct: 1, t: 20 },
  { text: 'Какая пустыня самая большая в мире?', opts: ['Сахара', 'Гоби', 'Калахари', 'Аравийская'], correct: 0, t: 20 },
  { text: 'Через какие страны протекает Амазонка?', opts: ['Только Бразилия', 'Бразилия, Перу, Колумбия', 'Бразилия и Перу', 'Все страны Южной Америки'], correct: 1, t: 20 },
];

app.post('/api/seed-geo', requireAdmin, (req, res) => {
  const { pin } = req.body || {};
  const g = getGameByPin(pin);
  if (!g) return res.status(404).json({ ok: false, error: 'no game' });
  const n0 = db.prepare('SELECT COUNT(*) c FROM questions WHERE game_id=?').get(g.id).c;
  const ins = db.prepare('INSERT INTO questions (game_id,text,opt1,opt2,opt3,opt4,correct,time_limit,order_idx) VALUES (?,?,?,?,?,?,?,?,?)');
  GEO_QUESTIONS.forEach((s, i) => ins.run(g.id, s.text, s.opts[0], s.opts[1], s.opts[2], s.opts[3], s.correct, s.t, n0 + i));
  res.json({ ok: true, added: GEO_QUESTIONS.length });
});

app.post('/api/manual', requireAdmin, (req, res) => {
  const { pin, playerId, contest, points, comment } = req.body || {};
  const g = getGameByPin(pin);
  if (!g) return res.status(404).json({ ok: false });
  db.prepare('INSERT INTO manual_scores (game_id,player_id,contest,points,comment,created_at) VALUES (?,?,?,?,?,?)')
    .run(g.id, playerId, contest || 'contest', Number(points) || 0, comment || '', Date.now());
  emitLeaderboard(pin);
  res.json({ ok: true });
});

app.delete('/api/manual/:id', requireAdmin, (req, res) => {
  const m = db.prepare('SELECT game_id FROM manual_scores WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM manual_scores WHERE id=?').run(req.params.id);
  if (m) {
    const g = db.prepare('SELECT pin FROM games WHERE id=?').get(m.game_id);
    if (g) emitLeaderboard(g.pin);
  }
  res.json({ ok: true });
});

app.delete('/api/players/:id', requireAdmin, (req, res) => {
  const pid = Number(req.params.id);
  const p = db.prepare('SELECT game_id FROM players WHERE id=?').get(pid);
  if (!p) return res.json({ ok: true });
  db.prepare('DELETE FROM answers WHERE player_id=?').run(pid);
  db.prepare('DELETE FROM manual_scores WHERE player_id=?').run(pid);
  db.prepare('DELETE FROM players WHERE id=?').run(pid);
  // disconnect socket if active
  const sid = activePlayers.get(pid);
  if (sid) {
    const s = io.sockets.sockets.get(sid);
    if (s) s.disconnect(true);
    activePlayers.delete(pid);
  }
  // emit leaderboard update
  const g = db.prepare('SELECT pin FROM games WHERE id=?').get(p.game_id);
  if (g) emitLeaderboard(g.pin);
  res.json({ ok: true });
});

app.get('/api/export/:pin', requireAdmin, (req, res) => {
  const g = getGameByPin(req.params.pin);
  if (!g) return res.status(404).send('no game');
  const rows = leaderboard(g.id);
  const manual = db.prepare(`SELECT ms.*, p.nick FROM manual_scores ms JOIN players p ON p.id=ms.player_id WHERE ms.game_id=?`).all(g.id);
  let csv = 'rank,nick,quiz_correct,manual,total\n';
  rows.forEach((r, i) => { csv += `${i+1},"${r.nick}",${r.correct},${r.manual},${r.total}\n`; });
  csv += '\nmanual_scores\nplayer,contest,points,comment\n';
  manual.forEach(m => { csv += `"${m.nick}","${m.contest}",${m.points},"${(m.comment||'').replace(/"/g,'""')}"\n`; });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="game_' + g.pin + '.csv"');
  res.send('\uFEFF' + csv);
});

app.get('/api/backup', requireAdmin, (req, res) => {
  const dbPath = process.env.DB_PATH || require('path').join(__dirname, 'data.db');
  res.download(dbPath, 'funhouse_backup.db');
});

app.get('/api/manual/:pin', requireAdmin, (req, res) => {
  const g = getGameByPin(req.params.pin);
  if (!g) return res.status(404).json({ ok: false });
  const rows = db.prepare(`
    SELECT ms.*, p.nick FROM manual_scores ms JOIN players p ON p.id=ms.player_id
    WHERE ms.game_id=? ORDER BY ms.id DESC
  `).all(g.id);
  res.json(rows);
});

// ---------- sockets ----------
io.on('connection', (socket) => {
  socket.on('admin_join', ({ password }) => {
    if (password === ADMIN_PASSWORD) {
      socket.data.isAdmin = true;
      socket.emit('admin_ok');
    } else {
      socket.emit('error', { msg: 'bad password' });
    }
  });

  socket.on('join_room_admin', ({ pin }) => {
    if (!socket.data.isAdmin) return socket.emit('error', { msg: 'admin only' });
    const g = getGameByPin(pin);
    if (!g) return socket.emit('error', { msg: 'no game' });
    socket.join('admin:' + pin);
    socket.emit('state', { status: g.status, current: g.current_q, total: questionsFor(g.id).length, question: questionsFor(g.id)[g.current_q-1] || null });
    socket.emit('leaderboard', leaderboard(g.id));
  });

  socket.on('join_board', ({ pin }) => {
    const g = getGameByPin(pin);
    if (!g) return socket.emit('error', { msg: 'no game' });
    socket.data.pin = pin;
    socket.join('game:' + pin);
    socket.emit('joined', { playerId: null, nick: '__board__' });
    const qs = questionsFor(g.id);
    if (g.status === 'open') {
      const q = qs[g.current_q - 1];
      const endsAt = g.ends_at || (Date.now() + q.time_limit * 1000);
      socket.emit('question_open', { id: q.id, text: q.text, opts: [q.opt1,q.opt2,q.opt3,q.opt4], time: q.time_limit, endsAt, index: g.current_q, total: qs.length, serverTime: Date.now() });
    } else if (g.status === 'reveal') {
      const q = qs[g.current_q - 1];
      socket.emit('reveal', { correct: q.correct });
    } else if (g.status === 'finished') {
      socket.emit('finished', {});
    }
    socket.emit('leaderboard', leaderboard(g.id));
  });

  socket.on('join_game', ({ pin, nick }) => {
    const g = getGameByPin(pin);
    if (!g) return socket.emit('error', { msg: 'no game' });
    if (!nick) return socket.emit('error', { msg: 'nick required' });
    let p = db.prepare('SELECT * FROM players WHERE game_id=? AND nick=?').get(g.id, nick);
    if (p) {
      // block if already connected
      const sid = activePlayers.get(p.id);
      if (sid && io.sockets.sockets.has(sid)) {
        return socket.emit('error', { msg: 'Этот ник уже в игре. Выбери другой или подожди.' });
      }
    } else {
      const info = db.prepare('INSERT INTO players (game_id, nick) VALUES (?,?)').run(g.id, nick);
      p = { id: info.lastInsertRowid, game_id: g.id, nick };
    }
    // rejoin: remove old socket mapping if any
    activePlayers.set(p.id, socket.id);
    socket.data.playerId = p.id;
    socket.data.pin = pin;
    socket.join('game:' + pin);
    socket.emit('joined', { playerId: p.id, nick: p.nick });
    // send current state
    const qs = questionsFor(g.id);
    if (g.status === 'open') {
      const q = qs[g.current_q - 1];
      const endsAt = g.ends_at || (Date.now() + q.time_limit * 1000);
      socket.emit('question_open', { id: q.id, text: q.text, opts: [q.opt1,q.opt2,q.opt3,q.opt4], time: q.time_limit, endsAt, index: g.current_q, total: qs.length, serverTime: Date.now() });
    } else if (g.status === 'reveal') {
      const q = qs[g.current_q - 1];
      socket.emit('reveal', { correct: q.correct });
    } else if (g.status === 'finished') {
      socket.emit('finished', {});
    }
    socket.emit('leaderboard', leaderboard(g.id));
    emitLeaderboard(pin);
  });

  socket.on('admin_start', ({ pin }) => {
    if (!socket.data.isAdmin) return;
    const g = getGameByPin(pin);
    if (!g) return;
    db.prepare('UPDATE games SET status=?, current_q=? WHERE id=?').run('lobby', g.id, 0);
    // start first question
    db.prepare('UPDATE games SET current_q=? WHERE id=?').run(1, g.id);
    openQuestion(pin);
  });

  socket.on('admin_next', ({ pin }) => {
    if (!socket.data.isAdmin) return;
    const g = getGameByPin(pin);
    if (!g) return;
    const qs = questionsFor(g.id);
    const next = g.current_q + 1;
    if (next > qs.length) { finishGame(pin); return; }
    db.prepare('UPDATE games SET current_q=? WHERE id=?').run(next, g.id);
    openQuestion(pin);
  });

  socket.on('admin_reveal', ({ pin }) => {
    if (!socket.data.isAdmin) return;
    revealAnswer(pin);
  });

  socket.on('admin_stop', ({ pin }) => {
    if (!socket.data.isAdmin) return;
    clearTimer(pin);
    const g = getGameByPin(pin);
    if (!g) return;
    db.prepare('UPDATE games SET status=? WHERE id=?').run('lobby', g.id);
    io.to('game:' + pin).emit('stopped', {});
    emitState(pin);
  });

  socket.on('answer', ({ pin, playerId, questionId, choice }) => {
    const g = getGameByPin(pin);
    if (!g || g.status !== 'open') return;
    const qs = questionsFor(g.id);
    const q = qs.find(x => x.id === questionId);
    if (!q) return;
    const p = db.prepare('SELECT id FROM players WHERE id=? AND game_id=?').get(playerId, g.id);
    if (!p) return;
    const exists = db.prepare('SELECT id FROM answers WHERE player_id=? AND question_id=?').get(playerId, questionId);
    if (exists) return;
    const isCorrect = (Number(choice) === q.correct) ? 1 : 0;
    db.prepare('INSERT INTO answers (game_id,player_id,question_id,choice,is_correct,response_ms,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(g.id, playerId, questionId, Number(choice), isCorrect, 0, Date.now());
    socket.emit('answer_ack', { ok: true });
    // progress broadcast
    const totalPlayers = db.prepare('SELECT COUNT(*) c FROM players WHERE game_id=?').get(g.id).c;
    const answered = db.prepare('SELECT COUNT(*) c FROM answers WHERE question_id=?').get(questionId).c;
    const prog = { answered, total: totalPlayers };
    io.to('game:' + pin).emit('answer_progress', prog);
    io.to('admin:' + pin).emit('answer_progress', prog);
  });

  socket.on('disconnect', () => {
    if (socket.data && socket.data.playerId) {
      const pid = socket.data.playerId;
      if (activePlayers.get(pid) === socket.id) activePlayers.delete(pid);
    }
  });
});

server.listen(PORT, () => {
  console.log(`FunHouse quiz running on http://localhost:${PORT}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
});
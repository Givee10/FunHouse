const { test, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { io } = require('socket.io-client');

const TEST_DB = path.join(__dirname, 'test.db');
process.env.DB_PATH = TEST_DB;
process.env.ADMIN_PASSWORD = 'testpass';
process.env.PORT = '3099';

// clean db
for (const f of [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm']) {
  try { fs.unlinkSync(f); } catch {}
}

const { Server } = require('socket.io');
let serverProc;
let baseUrl = 'http://localhost:3099';

function req(path, method = 'GET', body, cookie) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (cookie) headers['Cookie'] = cookie;
    const r = http.request({ hostname: 'localhost', port: 3099, path, method, headers }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

before(async () => {
  // start server in-process
  const app = require('../server');
  // server.js calls listen; wait
  await new Promise(r => setTimeout(r, 1000));
});

after(async () => {
  for (const f of [TEST_DB, TEST_DB + '-wal', TEST_DB + '-shm']) {
    try { fs.unlinkSync(f); } catch {}
  }
  process.exit(0);
});

test('GET / returns 200', async () => {
  const r = await req('/');
  assert.strictEqual(r.status, 200);
});

test('admin login wrong password -> 401', async () => {
  const r = await req('/api/admin/login', 'POST', { password: 'wrong' });
  assert.strictEqual(r.status, 401);
});

test('admin login correct -> 200', async () => {
  const r = await req('/api/admin/login', 'POST', { password: 'testpass' });
  assert.strictEqual(r.status, 200);
  assert.ok(r.headers['set-cookie']);
});

test('create game requires admin -> 401 without cookie', async () => {
  const r = await req('/api/games', 'POST', {});
  assert.strictEqual(r.status, 401);
});

test('create game with admin cookie', async () => {
  const login = await req('/api/admin/login', 'POST', { password: 'testpass' });
  const cookie = (login.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  const r = await req('/api/games', 'POST', {}, cookie);
  assert.strictEqual(r.status, 200);
  const d = JSON.parse(r.body);
  assert.ok(d.ok);
  assert.ok(d.pin);
});

test('socket: join game and receive joined', async () => {
  const login = await req('/api/admin/login', 'POST', { password: 'testpass' });
  const cookie = (login.headers['set-cookie'] || []).map(c => c.split(';')[0]).join('; ');
  const g = await req('/api/games', 'POST', {}, cookie);
  const pin = JSON.parse(g.body).pin;
  const s = io('http://localhost:3099');
  const joined = await new Promise((resolve, reject) => {
    s.on('connect', () => s.emit('join_game', { pin, nick: 'Tester' }));
    s.on('joined', d => resolve(d));
    s.on('error', e => reject(new Error(e.msg)));
    setTimeout(() => reject(new Error('timeout')), 5000);
  });
  assert.strictEqual(joined.nick, 'Tester');
  s.disconnect();
});
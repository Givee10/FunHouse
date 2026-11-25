const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.db');
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pin TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'lobby',
  current_q INTEGER DEFAULT 0,
  ends_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  opt1 TEXT NOT NULL, opt2 TEXT NOT NULL, opt3 TEXT NOT NULL, opt4 TEXT NOT NULL,
  correct INTEGER NOT NULL,
  time_limit INTEGER NOT NULL DEFAULT 20,
  order_idx INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  nick TEXT NOT NULL,
  UNIQUE(game_id, nick)
);
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  question_id INTEGER NOT NULL,
  choice INTEGER NOT NULL,
  is_correct INTEGER NOT NULL,
  response_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(player_id, question_id)
);
CREATE TABLE IF NOT EXISTS manual_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  contest TEXT NOT NULL,
  points INTEGER NOT NULL,
  comment TEXT,
  created_at INTEGER NOT NULL
);
`);

try { db.exec('ALTER TABLE games ADD COLUMN ends_at INTEGER'); } catch (e) { /* already exists */ }
module.exports = db;
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const backendRoot = path.resolve(__dirname, '../..');
const configuredPath = process.env.DB_PATH || './database/data/quick_notes.db';
const dbPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.resolve(backendRoot, configuredPath);

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

module.exports = db;

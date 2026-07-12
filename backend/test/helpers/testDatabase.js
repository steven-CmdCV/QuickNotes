const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const backendRoot = path.resolve(__dirname, '../..');
const mainDatabasePath = path.resolve(
  backendRoot,
  'database/data/quick_notes.db'
);
const schemaPath = path.resolve(backendRoot, 'database/schema.sql');
const seedPath = path.resolve(backendRoot, 'database/seed.sql');

function createTestDatabase() {
  const directoryPath = fs.mkdtempSync(
    path.join(os.tmpdir(), 'quick-notes-api-test-')
  );
  const databasePath = path.resolve(directoryPath, 'quick_notes_test.db');

  if (databasePath === mainDatabasePath) {
    fs.rmSync(directoryPath, { recursive: true, force: true });
    throw new Error('La base temporal coincide con la base principal.');
  }

  const db = new Database(databasePath);

  try {
    db.pragma('foreign_keys = ON');
    db.exec(fs.readFileSync(schemaPath, 'utf8'));
    db.exec(fs.readFileSync(seedPath, 'utf8'));

    const initialCounts = {
      users: db.prepare('SELECT COUNT(*) FROM usuarios').pluck().get(),
      categories: db.prepare('SELECT COUNT(*) FROM categorias').pluck().get(),
      notes: db.prepare('SELECT COUNT(*) FROM notas').pluck().get()
    };

    if (db.pragma('foreign_keys', { simple: true }) !== 1) {
      throw new Error('Las claves foraneas no estan activas en las pruebas.');
    }

    return {
      databasePath,
      directoryPath,
      initialCounts
    };
  } catch (error) {
    db.close();
    fs.rmSync(directoryPath, { recursive: true, force: true });
    throw error;
  } finally {
    if (db.open) {
      db.close();
    }
  }
}

function removeTestDatabase(directoryPath) {
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

module.exports = {
  backendRoot,
  mainDatabasePath,
  createTestDatabase,
  removeTestDatabase
};

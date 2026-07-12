const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const databaseDir = path.join(__dirname, 'data');
const databasePath = path.join(databaseDir, 'quick_notes.db');
const schemaPath = path.join(__dirname, 'schema.sql');
const seedPath = path.join(__dirname, 'seed.sql');

function readSqlFile(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

try {
  fs.mkdirSync(databaseDir, { recursive: true });

  console.log('Inicializando base de datos de Quick Notes...');
  console.log(`Archivo SQLite: ${databasePath}`);

  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');

  const schemaSql = readSqlFile(schemaPath);
  const seedSql = readSqlFile(seedPath);

  db.exec(schemaSql);
  console.log('Esquema creado o verificado correctamente.');

  db.exec(seedSql);
  console.log('Datos iniciales insertados o verificados correctamente.');

  const foreignKeys = db.pragma('foreign_keys', { simple: true });
  db.close();

  if (foreignKeys !== 1) {
    throw new Error('No se pudo activar PRAGMA foreign_keys.');
  }

  console.log('Base de datos inicializada correctamente.');
} catch (error) {
  console.error('Error al inicializar la base de datos:');
  console.error(error.message);
  process.exit(1);
}

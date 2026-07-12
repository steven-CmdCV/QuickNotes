const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const request = require('supertest');
const {
  backendRoot,
  mainDatabasePath,
  createTestDatabase,
  removeTestDatabase
} = require('./helpers/testDatabase');

describe('Quick Notes API', { concurrency: false }, () => {
  const hadOriginalDbPath = Object.prototype.hasOwnProperty.call(
    process.env,
    'DB_PATH'
  );
  const originalDbPath = process.env.DB_PATH;
  const srcRoot = path.resolve(backendRoot, 'src');

  let app;
  let db;
  let testDatabase;
  let createdNoteId;
  let createdNoteDate;

  before(() => {
    testDatabase = createTestDatabase();

    assert.notStrictEqual(
      path.resolve(testDatabase.databasePath),
      path.resolve(mainDatabasePath),
      'La suite no puede utilizar la base principal.'
    );
    assert.deepStrictEqual(testDatabase.initialCounts, {
      users: 1,
      categories: 5,
      notes: 2
    });

    process.env.DB_PATH = testDatabase.databasePath;

    app = require('../src/app');
    db = require('../src/config/db');

    assert.strictEqual(db.pragma('foreign_keys', { simple: true }), 1);

    console.log(JSON.stringify({
      testDatabasePath: testDatabase.databasePath,
      differsFromMainDatabase: true,
      initialCounts: testDatabase.initialCounts
    }));
  });

  after(() => {
    if (db && db.open) {
      db.close();
    }

    if (hadOriginalDbPath) {
      process.env.DB_PATH = originalDbPath;
    } else {
      delete process.env.DB_PATH;
    }

    for (const modulePath of Object.keys(require.cache)) {
      if (modulePath.startsWith(`${srcRoot}${path.sep}`)) {
        delete require.cache[modulePath];
      }
    }

    if (testDatabase) {
      removeTestDatabase(testDatabase.directoryPath);
      assert.strictEqual(fs.existsSync(testDatabase.directoryPath), false);

      console.log(JSON.stringify({
        removedTestDirectory: testDatabase.directoryPath,
        existsAfterCleanup: false
      }));
    }
  });

  test('GET /api/health devuelve el estado del backend', async () => {
    const response = await request(app).get('/api/health').expect(200);

    assert.strictEqual(response.body.status, 'ok');
    assert.strictEqual(typeof response.body.message, 'string');
  });

  test('GET /api/categories devuelve cinco categorias ordenadas', async () => {
    const response = await request(app).get('/api/categories').expect(200);
    const categoryNames = response.body.data.map(
      (category) => category.nombre_categoria
    );

    assert.strictEqual(response.body.success, true);
    assert.deepStrictEqual(categoryNames, [
      'Academico',
      'Ideas',
      'Personal',
      'Recordatorios',
      'Trabajo'
    ]);
  });

  test('GET /api/notes devuelve las dos notas demo', async () => {
    const response = await request(app).get('/api/notes').expect(200);

    assert.strictEqual(response.body.success, true);
    assert.ok(Array.isArray(response.body.data));
    assert.strictEqual(response.body.data.length, 2);
    assert.deepStrictEqual(
      response.body.data.map((note) => note.id_nota),
      [1, 2]
    );
    assert.ok(
      response.body.data.every(
        (note) => typeof note.es_favorita === 'boolean'
      )
    );
  });

  test('GET /api/notes/1 devuelve una nota como objeto', async () => {
    const response = await request(app).get('/api/notes/1').expect(200);

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(Array.isArray(response.body.data), false);
    assert.strictEqual(response.body.data.id_nota, 1);
  });

  test('GET /api/notes/9999 devuelve nota no encontrada', async () => {
    const response = await request(app).get('/api/notes/9999').expect(404);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Nota no encontrada.'
    });
  });

  test('GET /api/notes/abc rechaza un identificador invalido', async () => {
    const response = await request(app).get('/api/notes/abc').expect(400);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'El identificador de la nota no es válido.'
    });
  });

  test('POST /api/notes crea una nota para el usuario demo', async () => {
    const response = await request(app)
      .post('/api/notes')
      .send({
        titulo: 'Nota temporal automatizada',
        contenido: 'Creada por la suite de integracion.',
        id_categoria: 1,
        es_favorita: false
      })
      .expect(201);

    createdNoteId = response.body.data.id_nota;
    createdNoteDate = response.body.data.fecha_creacion;

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.data.id_usuario, 1);
    assert.strictEqual(response.body.data.es_favorita, false);
    assert.strictEqual(typeof createdNoteId, 'number');

    const detailResponse = await request(app)
      .get(`/api/notes/${createdNoteId}`)
      .expect(200);

    assert.strictEqual(detailResponse.body.data.id_nota, createdNoteId);
  });

  test('PUT /api/notes/:id actualiza la nota temporal', async () => {
    assert.strictEqual(typeof createdNoteId, 'number');

    const response = await request(app)
      .put(`/api/notes/${createdNoteId}`)
      .send({
        titulo: 'Nota temporal actualizada',
        contenido: 'Contenido actualizado por la suite.',
        id_categoria: 2,
        es_favorita: true
      })
      .expect(200);

    assert.strictEqual(Array.isArray(response.body.data), false);
    assert.strictEqual(response.body.data.titulo, 'Nota temporal actualizada');
    assert.strictEqual(
      response.body.data.contenido,
      'Contenido actualizado por la suite.'
    );
    assert.strictEqual(response.body.data.id_categoria, 2);
    assert.strictEqual(response.body.data.nombre_categoria, 'Personal');
    assert.strictEqual(response.body.data.es_favorita, true);
    assert.strictEqual(response.body.data.fecha_creacion, createdNoteDate);
  });

  test('DELETE /api/notes/:id elimina la nota temporal', async () => {
    assert.strictEqual(typeof createdNoteId, 'number');

    const response = await request(app)
      .delete(`/api/notes/${createdNoteId}`)
      .expect(200);

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.data.id_nota, createdNoteId);

    await request(app).get(`/api/notes/${createdNoteId}`).expect(404);

    const listResponse = await request(app).get('/api/notes').expect(200);

    assert.deepStrictEqual(
      listResponse.body.data.map((note) => note.id_nota),
      [1, 2]
    );
  });

  test('GET /api/unknown devuelve la ruta no encontrada', async () => {
    const response = await request(app).get('/api/unknown').expect(404);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Ruta no encontrada.'
    });
  });

  test('POST /api/notes rechaza JSON malformado sin exponer detalles', async () => {
    const response = await request(app)
      .post('/api/notes')
      .set('Content-Type', 'application/json')
      .send('{"titulo":"Prueba","contenido":')
      .expect('Content-Type', /json/)
      .expect(400);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'El cuerpo de la solicitud no contiene JSON válido.'
    });
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(response.body, 'stack'),
      false
    );
    assert.doesNotMatch(
      response.text,
      /(\/Users\/|node_modules|backend\/src|\.js:\d+)/
    );
  });
});

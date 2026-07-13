const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const {
  backendRoot,
  mainDatabasePath,
  createTestDatabase,
  removeTestDatabase
} = require('./helpers/testDatabase');

const DEMO_EMAIL = 'demo@quicknotes.local';
const DEMO_PASSWORD = 'QuickNotesDemo2026!';
const TEST_JWT_SECRET = 'quick-notes-integration-test-secret';

describe('Quick Notes API', { concurrency: false }, () => {
  const hadOriginalDbPath = Object.prototype.hasOwnProperty.call(
    process.env,
    'DB_PATH'
  );
  const originalDbPath = process.env.DB_PATH;
  const hadOriginalJwtSecret = Object.prototype.hasOwnProperty.call(
    process.env,
    'JWT_SECRET'
  );
  const originalJwtSecret = process.env.JWT_SECRET;
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
    process.env.JWT_SECRET = TEST_JWT_SECRET;

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

    if (hadOriginalJwtSecret) {
      process.env.JWT_SECRET = originalJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
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

  test('POST /api/auth/login autentica al usuario demo', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        correo: `  ${DEMO_EMAIL.toUpperCase()}  `,
        password: DEMO_PASSWORD
      })
      .expect(200);

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(typeof response.body.data.token, 'string');
    assert.strictEqual(response.body.data.token_type, 'Bearer');
    assert.strictEqual(response.body.data.expires_in, 7200);
    assert.deepStrictEqual(response.body.data.user, {
      id_usuario: 1,
      nombre: 'Usuario Demo',
      correo: DEMO_EMAIL
    });
  });

  test('POST /api/auth/login rechaza una contrasena incorrecta', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        correo: DEMO_EMAIL,
        password: 'ContrasenaIncorrecta'
      })
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Credenciales inválidas.'
    });
  });

  test('POST /api/auth/login no revela si el correo existe', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        correo: 'no-existe@quicknotes.local',
        password: DEMO_PASSWORD
      })
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Credenciales inválidas.'
    });
  });

  test('POST /api/auth/login exige ambos campos', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ correo: DEMO_EMAIL })
      .expect(400);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'El correo y la contraseña son obligatorios.'
    });
  });

  test('POST /api/auth/login rechaza tipos incorrectos', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ correo: 1, password: true })
      .expect(400);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'El correo y la contraseña deben ser cadenas de texto.'
    });
  });

  test('POST /api/auth/login rechaza valores vacios', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ correo: '   ', password: '' })
      .expect(400);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'El correo y la contraseña son obligatorios.'
    });
  });

  test('POST /api/auth/login nunca devuelve password_hash', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ correo: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    assert.strictEqual(response.text.includes('password_hash'), false);
  });

  test('GET /api/auth/me devuelve el usuario del token', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ correo: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .expect(200);

    assert.deepStrictEqual(response.body, {
      success: true,
      data: {
        user: {
          id_usuario: 1,
          nombre: 'Usuario Demo',
          correo: DEMO_EMAIL
        }
      }
    });
  });

  test('GET /api/auth/me exige Authorization', async () => {
    const response = await request(app).get('/api/auth/me').expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('GET /api/auth/me rechaza un esquema distinto de Bearer', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Basic credenciales')
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('GET /api/auth/me rechaza un token malformado', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-malformado')
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Token inválido o expirado.'
    });
  });

  test('GET /api/auth/me rechaza otra firma', async () => {
    const token = jwt.sign({}, 'otro-secreto-de-prueba', {
      algorithm: 'HS256',
      expiresIn: '2h',
      subject: '1'
    });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Token inválido o expirado.'
    });
  });

  test('GET /api/auth/me rechaza un token expirado', async () => {
    const token = jwt.sign({}, TEST_JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: -1,
      subject: '1'
    });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Token inválido o expirado.'
    });
  });

  test('GET /api/auth/me rechaza un sub invalido', async () => {
    const token = jwt.sign({}, TEST_JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '2h',
      subject: 'abc'
    });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Token inválido o expirado.'
    });
  });

  test('GET /api/auth/me rechaza un usuario que ya no existe', async () => {
    const token = jwt.sign({}, TEST_JWT_SECRET, {
      algorithm: 'HS256',
      expiresIn: '2h',
      subject: '9999'
    });
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Token inválido o expirado.'
    });
  });

  test('GET /api/auth/me nunca devuelve password_hash', async () => {
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ correo: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .expect(200);

    assert.strictEqual(response.text.includes('password_hash'), false);
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

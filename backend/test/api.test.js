const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { after, before, describe, test } = require('node:test');
const bcrypt = require('bcryptjs');
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
const REGISTERED_EMAIL = 'registro@quicknotes.local';
const UPDATED_REGISTERED_EMAIL = 'perfil-actualizado@quicknotes.local';
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
  let demoToken;
  let secondUserId;
  let secondUserToken;
  let secondUserNoteId;
  let emptyUserToken;
  let nonexistentUserToken;
  let createdNoteId;
  let createdNoteDate;
  let registeredUserId;
  let registeredUserToken;
  let concurrentUserId;
  let concurrentUserToken;

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
    const { createToken } = require('../src/services/tokenService');

    assert.strictEqual(db.pragma('foreign_keys', { simple: true }), 1);

    demoToken = createToken(1);

    const secondUserResult = db.prepare(`
      INSERT INTO usuarios (nombre, correo, password_hash)
      VALUES (?, ?, ?)
    `).run(
      'Usuario de aislamiento',
      'aislamiento@quicknotes.local',
      'hash-ficticio-no-utilizado'
    );
    secondUserId = Number(secondUserResult.lastInsertRowid);
    secondUserToken = createToken(secondUserId);

    const secondUserNoteResult = db.prepare(`
      INSERT INTO notas (
        id_usuario,
        id_categoria,
        titulo,
        contenido,
        es_favorita
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      secondUserId,
      2,
      'Nota aislada',
      'Pertenece exclusivamente al segundo usuario.',
      0
    );
    secondUserNoteId = Number(secondUserNoteResult.lastInsertRowid);

    const emptyUserResult = db.prepare(`
      INSERT INTO usuarios (nombre, correo, password_hash)
      VALUES (?, ?, ?)
    `).run(
      'Usuario sin notas',
      'sin-notas@quicknotes.local',
      'hash-ficticio-no-utilizado'
    );
    emptyUserToken = createToken(Number(emptyUserResult.lastInsertRowid));
    nonexistentUserToken = createToken(9999);

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

  test('POST /api/auth/register crea una sesion y normaliza el usuario', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: '  Usuario Registrado  ',
        correo: `  ${REGISTERED_EMAIL.toUpperCase()}  `,
        password: DEMO_PASSWORD,
        password_confirmation: 'no se envia al modelo',
        password_hash: 'no se acepta desde el cliente'
      })
      .expect(201);

    registeredUserId = response.body.data.user.id_usuario;
    registeredUserToken = response.body.data.token;

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(typeof registeredUserId, 'number');
    assert.strictEqual(typeof registeredUserToken, 'string');
    assert.strictEqual(response.body.data.token_type, 'Bearer');
    assert.strictEqual(response.body.data.expires_in, 7200);
    assert.deepStrictEqual(response.body.data.user, {
      id_usuario: registeredUserId,
      nombre: 'Usuario Registrado',
      correo: REGISTERED_EMAIL
    });
    assert.strictEqual(response.text.includes('password_hash'), false);
    assert.strictEqual(response.text.includes(DEMO_PASSWORD), false);
  });

  test('POST /api/auth/register persiste un hash bcrypt valido', async () => {
    const storedUser = db.prepare(`
      SELECT nombre, correo, password_hash
      FROM usuarios
      WHERE id_usuario = ?
    `).get(registeredUserId);

    assert.strictEqual(storedUser.nombre, 'Usuario Registrado');
    assert.strictEqual(storedUser.correo, REGISTERED_EMAIL);
    assert.notStrictEqual(storedUser.password_hash, DEMO_PASSWORD);
    assert.strictEqual(bcrypt.getRounds(storedUser.password_hash), 10);
    assert.strictEqual(
      await bcrypt.compare(DEMO_PASSWORD, storedUser.password_hash),
      true
    );
  });

  test('POST /api/auth/register rechaza un correo duplicado', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'Duplicado',
        correo: REGISTERED_EMAIL,
        password: DEMO_PASSWORD
      })
      .expect(409);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Ya existe una cuenta con ese correo.'
    });
  });

  test('POST /api/auth/register detecta duplicados con espacios y mayusculas', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        nombre: 'Duplicado normalizado',
        correo: `  ${REGISTERED_EMAIL.toUpperCase()}  `,
        password: DEMO_PASSWORD
      })
      .expect(409);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Ya existe una cuenta con ese correo.'
    });
  });

  test('dos registros concurrentes producen un exito y un conflicto', async () => {
    const email = 'concurrente@quicknotes.local';
    const responses = await Promise.all([
      request(app).post('/api/auth/register').send({
        nombre: 'Usuario Concurrente A',
        correo: email,
        password: DEMO_PASSWORD
      }),
      request(app).post('/api/auth/register').send({
        nombre: 'Usuario Concurrente B',
        correo: email.toUpperCase(),
        password: DEMO_PASSWORD
      })
    ]);
    const statuses = responses.map((response) => response.status).sort();
    const successfulResponse = responses.find(
      (response) => response.status === 201
    );

    assert.deepStrictEqual(statuses, [201, 409]);
    assert.strictEqual(
      db.prepare('SELECT COUNT(*) FROM usuarios WHERE correo = ?')
        .pluck()
        .get(email),
      1
    );
    concurrentUserId = successfulResponse.body.data.user.id_usuario;
    concurrentUserToken = successfulResponse.body.data.token;
  });

  test('POST /api/auth/register valida el nombre', async () => {
    const invalidBodies = [
      { correo: 'nombre-1@quicknotes.local', password: DEMO_PASSWORD },
      {
        nombre: 10,
        correo: 'nombre-2@quicknotes.local',
        password: DEMO_PASSWORD
      },
      {
        nombre: '   ',
        correo: 'nombre-3@quicknotes.local',
        password: DEMO_PASSWORD
      },
      {
        nombre: 'a'.repeat(101),
        correo: 'nombre-4@quicknotes.local',
        password: DEMO_PASSWORD
      }
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .post('/api/auth/register')
        .send(body);

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
    }
  });

  test('POST /api/auth/register valida el correo', async () => {
    const invalidBodies = [
      { nombre: 'Correo 1', password: DEMO_PASSWORD },
      { nombre: 'Correo 2', correo: 10, password: DEMO_PASSWORD },
      { nombre: 'Correo 3', correo: '   ', password: DEMO_PASSWORD },
      {
        nombre: 'Correo 4',
        correo: 'correo-invalido',
        password: DEMO_PASSWORD
      },
      {
        nombre: 'Correo 5',
        correo: `${'a'.repeat(250)}@test.com`,
        password: DEMO_PASSWORD
      }
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .post('/api/auth/register')
        .send(body);

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
    }
  });

  test('POST /api/auth/register valida la contrasena', async () => {
    const invalidBodies = [
      { nombre: 'Password 1', correo: 'password-1@quicknotes.local' },
      {
        nombre: 'Password 2',
        correo: 'password-2@quicknotes.local',
        password: 10
      },
      {
        nombre: 'Password 3',
        correo: 'password-3@quicknotes.local',
        password: 'corta'
      },
      {
        nombre: 'Password 4',
        correo: 'password-4@quicknotes.local',
        password: 'a'.repeat(73)
      }
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .post('/api/auth/register')
        .send(body);

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
    }
  });

  test('el token del registro funciona con GET /api/auth/me', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registeredUserToken}`)
      .expect(200);

    assert.deepStrictEqual(response.body, {
      success: true,
      data: {
        user: {
          id_usuario: registeredUserId,
          nombre: 'Usuario Registrado',
          correo: REGISTERED_EMAIL
        }
      }
    });
    assert.strictEqual(response.text.includes('password_hash'), false);
  });

  test('el usuario registrado puede iniciar sesion posteriormente', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ correo: REGISTERED_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.data.user.id_usuario, registeredUserId);
    assert.strictEqual(response.text.includes('password_hash'), false);
  });

  test('el usuario registrado comienza sin notas', async () => {
    const response = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${registeredUserToken}`)
      .expect(200);

    assert.deepStrictEqual(response.body, {
      success: true,
      data: []
    });
  });

  test('dos usuarios registrados mantienen sus notas aisladas', async () => {
    const firstNote = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${registeredUserToken}`)
      .send({
        titulo: 'Nota del registro principal',
        contenido: 'Solo debe verla el primer usuario registrado.',
        id_categoria: null,
        es_favorita: false
      })
      .expect(201);
    const secondNote = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${concurrentUserToken}`)
      .send({
        titulo: 'Nota del registro concurrente',
        contenido: 'Solo debe verla el segundo usuario registrado.',
        id_categoria: null,
        es_favorita: false
      })
      .expect(201);
    const firstList = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${registeredUserToken}`)
      .expect(200);
    const secondList = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${concurrentUserToken}`)
      .expect(200);

    assert.deepStrictEqual(
      firstList.body.data.map((note) => note.id_nota),
      [firstNote.body.data.id_nota]
    );
    assert.deepStrictEqual(
      secondList.body.data.map((note) => note.id_nota),
      [secondNote.body.data.id_nota]
    );
    assert.ok(firstList.body.data.every(
      (note) => note.id_usuario === registeredUserId
    ));
    assert.ok(secondList.body.data.every(
      (note) => note.id_usuario === concurrentUserId
    ));
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

  test('GET /api/notes exige autenticacion', async () => {
    const response = await request(app).get('/api/notes').expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('GET /api/notes/:id exige autenticacion', async () => {
    const response = await request(app).get('/api/notes/1').expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('GET /api/notes/abc autentica antes de validar el ID', async () => {
    const response = await request(app).get('/api/notes/abc').expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('POST /api/notes autentica antes de validar cuerpo y categoria', async () => {
    const response = await request(app)
      .post('/api/notes')
      .send({
        titulo: '   ',
        contenido: 'Esta nota no debe crearse.',
        id_categoria: 9999,
        es_favorita: false
      })
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('PUT /api/notes/:id exige autenticacion', async () => {
    const response = await request(app)
      .put('/api/notes/1')
      .send({
        titulo: 'Sin autenticacion',
        contenido: 'Esta nota no debe actualizarse.',
        id_categoria: null,
        es_favorita: false
      })
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('DELETE /api/notes/:id exige autenticacion', async () => {
    const response = await request(app).delete('/api/notes/1').expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('GET /api/notes rechaza el token de un usuario inexistente', async () => {
    const response = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${nonexistentUserToken}`)
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Token inválido o expirado.'
    });
  });

  test('GET /api/notes devuelve las dos notas demo autenticadas', async () => {
    const response = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);

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

  test('GET /api/notes aisla el listado del segundo usuario', async () => {
    const response = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .expect(200);

    assert.strictEqual(response.body.success, true);
    assert.deepStrictEqual(
      response.body.data.map((note) => note.id_nota),
      [secondUserNoteId]
    );
    assert.ok(
      response.body.data.every((note) => note.id_usuario === secondUserId)
    );
  });

  test('GET /api/notes devuelve un arreglo vacio al usuario sin notas', async () => {
    const response = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${emptyUserToken}`)
      .expect(200);

    assert.deepStrictEqual(response.body, {
      success: true,
      data: []
    });
  });

  test('GET /api/notes/1 devuelve una nota como objeto', async () => {
    const response = await request(app)
      .get('/api/notes/1')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(Array.isArray(response.body.data), false);
    assert.strictEqual(response.body.data.id_nota, 1);
  });

  test('GET /api/notes/9999 devuelve nota no encontrada', async () => {
    const response = await request(app)
      .get('/api/notes/9999')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(404);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Nota no encontrada.'
    });
  });

  test('GET /api/notes/abc rechaza un identificador invalido', async () => {
    const response = await request(app)
      .get('/api/notes/abc')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(400);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'El identificador de la nota no es válido.'
    });
  });

  test('el segundo usuario no puede consultar una nota demo', async () => {
    const response = await request(app)
      .get('/api/notes/1')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .expect(404);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Nota no encontrada.'
    });
  });

  test('el segundo usuario no puede modificar ni eliminar una nota demo', async () => {
    const noteBefore = db.prepare(`
      SELECT titulo, contenido, id_categoria, es_favorita
      FROM notas
      WHERE id_nota = 1
    `).get();

    const updateResponse = await request(app)
      .put('/api/notes/1')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({
        titulo: 'Intento ajeno',
        contenido: 'No debe modificar la nota demo.',
        id_categoria: null,
        es_favorita: false
      })
      .expect(404);

    assert.deepStrictEqual(updateResponse.body, {
      success: false,
      message: 'Nota no encontrada.'
    });

    const deleteResponse = await request(app)
      .delete('/api/notes/1')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .expect(404);

    assert.deepStrictEqual(deleteResponse.body, {
      success: false,
      message: 'Nota no encontrada.'
    });
    assert.deepStrictEqual(
      db.prepare(`
        SELECT titulo, contenido, id_categoria, es_favorita
        FROM notas
        WHERE id_nota = 1
      `).get(),
      noteBefore
    );
  });

  test('POST /api/notes crea una nota para el usuario demo', async () => {
    const response = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${demoToken}`)
      .send({
        titulo: 'Nota temporal automatizada',
        contenido: 'Creada por la suite de integracion.',
        id_categoria: 1,
        es_favorita: false,
        id_usuario: secondUserId
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
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);

    assert.strictEqual(detailResponse.body.data.id_nota, createdNoteId);
  });

  test('PUT /api/notes/:id actualiza la nota temporal', async () => {
    assert.strictEqual(typeof createdNoteId, 'number');

    const response = await request(app)
      .put(`/api/notes/${createdNoteId}`)
      .set('Authorization', `Bearer ${demoToken}`)
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
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.data.id_nota, createdNoteId);

    await request(app)
      .get(`/api/notes/${createdNoteId}`)
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(404);

    const listResponse = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(200);

    assert.deepStrictEqual(
      listResponse.body.data.map((note) => note.id_nota),
      [1, 2]
    );
  });

  test('el segundo usuario crea una nota propia aislada del usuario demo', async () => {
    const createResponse = await request(app)
      .post('/api/notes')
      .set('Authorization', `Bearer ${secondUserToken}`)
      .send({
        titulo: 'Nueva nota aislada',
        contenido: 'Creada por el segundo usuario.',
        id_categoria: null,
        es_favorita: true,
        id_usuario: 1
      })
      .expect(201);
    const newNoteId = createResponse.body.data.id_nota;

    assert.strictEqual(createResponse.body.success, true);
    assert.strictEqual(createResponse.body.data.id_usuario, secondUserId);
    assert.strictEqual(typeof newNoteId, 'number');
    assert.strictEqual(
      db.prepare('SELECT id_usuario FROM notas WHERE id_nota = ?')
        .get(newNoteId).id_usuario,
      secondUserId
    );

    const demoResponse = await request(app)
      .get(`/api/notes/${newNoteId}`)
      .set('Authorization', `Bearer ${demoToken}`)
      .expect(404);

    assert.deepStrictEqual(demoResponse.body, {
      success: false,
      message: 'Nota no encontrada.'
    });
  });

  test('PUT /api/users/me exige autenticacion', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .send({ nombre: 'Sin token', correo: 'sin-token@quicknotes.local' })
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('PUT /api/users/me valida el nombre', async () => {
    const invalidBodies = [
      { correo: UPDATED_REGISTERED_EMAIL },
      { nombre: 10, correo: UPDATED_REGISTERED_EMAIL },
      { nombre: '   ', correo: UPDATED_REGISTERED_EMAIL },
      { nombre: 'a'.repeat(101), correo: UPDATED_REGISTERED_EMAIL }
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${registeredUserToken}`)
        .send(body);

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
    }
  });

  test('PUT /api/users/me valida el correo', async () => {
    const invalidBodies = [
      { nombre: 'Perfil actualizado' },
      { nombre: 'Perfil actualizado', correo: 10 },
      { nombre: 'Perfil actualizado', correo: '   ' },
      { nombre: 'Perfil actualizado', correo: 'correo-invalido' },
      {
        nombre: 'Perfil actualizado',
        correo: `${'a'.repeat(250)}@test.com`
      }
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .put('/api/users/me')
        .set('Authorization', `Bearer ${registeredUserToken}`)
        .send(body);

      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.success, false);
    }
  });

  test('PUT /api/users/me actualiza solo el perfil autenticado', async () => {
    const otherUserBefore = db.prepare(`
      SELECT id_usuario, nombre, correo
      FROM usuarios
      WHERE id_usuario = ?
    `).get(concurrentUserId);
    const noteBefore = db.prepare(`
      SELECT id_nota, id_usuario, titulo, contenido
      FROM notas
      WHERE id_usuario = ?
    `).all(registeredUserId);

    const response = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${registeredUserToken}`)
      .send({
        nombre: '  Perfil Actualizado  ',
        correo: `  ${UPDATED_REGISTERED_EMAIL.toUpperCase()}  `,
        id_usuario: concurrentUserId,
        password: 'no debe utilizarse'
      })
      .expect(200);

    assert.deepStrictEqual(response.body, {
      success: true,
      data: {
        user: {
          id_usuario: registeredUserId,
          nombre: 'Perfil Actualizado',
          correo: UPDATED_REGISTERED_EMAIL
        }
      }
    });
    assert.strictEqual(response.text.includes('password_hash'), false);
    assert.strictEqual(response.text.includes('no debe utilizarse'), false);
    assert.deepStrictEqual(
      db.prepare(`
        SELECT id_usuario, nombre, correo
        FROM usuarios
        WHERE id_usuario = ?
      `).get(concurrentUserId),
      otherUserBefore
    );
    assert.deepStrictEqual(
      db.prepare(`
        SELECT id_nota, id_usuario, titulo, contenido
        FROM notas
        WHERE id_usuario = ?
      `).all(registeredUserId),
      noteBefore
    );
  });

  test('PUT /api/users/me permite conservar el correo actual', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${registeredUserToken}`)
      .send({
        nombre: 'Perfil Actualizado',
        correo: UPDATED_REGISTERED_EMAIL
      })
      .expect(200);

    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.data.user.correo, UPDATED_REGISTERED_EMAIL);
  });

  test('PUT /api/users/me rechaza el correo de otro usuario', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .set('Authorization', `Bearer ${registeredUserToken}`)
      .send({
        nombre: 'Perfil Actualizado',
        correo: 'aislamiento@quicknotes.local'
      })
      .expect(409);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Ya existe una cuenta con ese correo.'
    });
    assert.strictEqual(
      db.prepare('SELECT correo FROM usuarios WHERE id_usuario = ?')
        .get(registeredUserId).correo,
      UPDATED_REGISTERED_EMAIL
    );
  });

  test('el token actual conserva el perfil y las notas actualizadas', async () => {
    const profileResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${registeredUserToken}`)
      .expect(200);
    const notesResponse = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${registeredUserToken}`)
      .expect(200);

    assert.deepStrictEqual(profileResponse.body.data.user, {
      id_usuario: registeredUserId,
      nombre: 'Perfil Actualizado',
      correo: UPDATED_REGISTERED_EMAIL
    });
    assert.strictEqual(notesResponse.body.data.length, 1);
    assert.strictEqual(notesResponse.body.data[0].id_usuario, registeredUserId);
  });

  test('el perfil actualizado inicia sesion solo con el correo nuevo', async () => {
    const newEmailResponse = await request(app)
      .post('/api/auth/login')
      .send({ correo: UPDATED_REGISTERED_EMAIL, password: DEMO_PASSWORD })
      .expect(200);
    const oldEmailResponse = await request(app)
      .post('/api/auth/login')
      .send({ correo: REGISTERED_EMAIL, password: DEMO_PASSWORD })
      .expect(401);

    assert.strictEqual(
      newEmailResponse.body.data.user.id_usuario,
      registeredUserId
    );
    assert.deepStrictEqual(oldEmailResponse.body, {
      success: false,
      message: 'Credenciales inválidas.'
    });
  });

  test('DELETE /api/users/me exige autenticacion', async () => {
    const response = await request(app)
      .delete('/api/users/me')
      .send({ password: DEMO_PASSWORD })
      .expect(401);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'Autenticación requerida.'
    });
  });

  test('DELETE /api/users/me valida la contrasena', async () => {
    const missingResponse = await request(app)
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${concurrentUserToken}`)
      .send({})
      .expect(400);
    const typeResponse = await request(app)
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${concurrentUserToken}`)
      .send({ password: 10 })
      .expect(400);

    assert.deepStrictEqual(missingResponse.body, {
      success: false,
      message: 'La contraseña actual es obligatoria.'
    });
    assert.deepStrictEqual(typeResponse.body, {
      success: false,
      message: 'La contraseña actual debe ser una cadena de texto.'
    });
  });

  test('DELETE /api/users/me rechaza la contrasena incorrecta sin eliminar datos', async () => {
    const userBefore = db.prepare(`
      SELECT id_usuario, nombre, correo
      FROM usuarios
      WHERE id_usuario = ?
    `).get(concurrentUserId);
    const notesBefore = db.prepare(`
      SELECT id_nota, titulo
      FROM notas
      WHERE id_usuario = ?
      ORDER BY id_nota
    `).all(concurrentUserId);

    const response = await request(app)
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${concurrentUserToken}`)
      .send({ password: 'ContrasenaIncorrecta' })
      .expect(403);

    assert.deepStrictEqual(response.body, {
      success: false,
      message: 'La contraseña actual es incorrecta.'
    });
    assert.deepStrictEqual(
      db.prepare(`
        SELECT id_usuario, nombre, correo
        FROM usuarios
        WHERE id_usuario = ?
      `).get(concurrentUserId),
      userBefore
    );
    assert.deepStrictEqual(
      db.prepare(`
        SELECT id_nota, titulo
        FROM notas
        WHERE id_usuario = ?
        ORDER BY id_nota
      `).all(concurrentUserId),
      notesBefore
    );
  });

  test('DELETE /api/users/me elimina la cuenta y sus notas por cascada', async () => {
    assert.strictEqual(db.pragma('foreign_keys', { simple: true }), 1);

    const categoryCountBefore = db.prepare(
      'SELECT COUNT(*) FROM categorias'
    ).pluck().get();
    const otherUserBefore = db.prepare(`
      SELECT id_usuario, nombre, correo
      FROM usuarios
      WHERE id_usuario = ?
    `).get(registeredUserId);
    const otherNotesBefore = db.prepare(`
      SELECT id_nota, titulo
      FROM notas
      WHERE id_usuario = ?
      ORDER BY id_nota
    `).all(registeredUserId);

    assert.ok(db.prepare(
      'SELECT COUNT(*) FROM notas WHERE id_usuario = ?'
    ).pluck().get(concurrentUserId) > 0);

    const response = await request(app)
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${concurrentUserToken}`)
      .send({
        password: DEMO_PASSWORD,
        id_usuario: 1,
        correo: DEMO_EMAIL
      })
      .expect(200);

    assert.deepStrictEqual(response.body, {
      success: true,
      message: 'Cuenta eliminada correctamente.'
    });
    assert.strictEqual(response.text.includes('password_hash'), false);
    assert.strictEqual(response.text.includes(DEMO_PASSWORD), false);
    assert.strictEqual(
      db.prepare('SELECT COUNT(*) FROM usuarios WHERE id_usuario = ?')
        .pluck().get(concurrentUserId),
      0
    );
    assert.strictEqual(
      db.prepare('SELECT COUNT(*) FROM notas WHERE id_usuario = ?')
        .pluck().get(concurrentUserId),
      0
    );
    assert.strictEqual(
      db.prepare('SELECT COUNT(*) FROM categorias').pluck().get(),
      categoryCountBefore
    );
    assert.deepStrictEqual(
      db.prepare(`
        SELECT id_usuario, nombre, correo
        FROM usuarios
        WHERE id_usuario = ?
      `).get(registeredUserId),
      otherUserBefore
    );
    assert.deepStrictEqual(
      db.prepare(`
        SELECT id_nota, titulo
        FROM notas
        WHERE id_usuario = ?
        ORDER BY id_nota
      `).all(registeredUserId),
      otherNotesBefore
    );
    assert.strictEqual(
      db.prepare(`
        SELECT COUNT(*)
        FROM notas
        LEFT JOIN usuarios USING (id_usuario)
        WHERE usuarios.id_usuario IS NULL
      `).pluck().get(),
      0
    );
    assert.deepStrictEqual(db.pragma('foreign_key_check'), []);
  });

  test('el token de la cuenta eliminada deja de autorizar solicitudes', async () => {
    const profileResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${concurrentUserToken}`)
      .expect(401);
    const notesResponse = await request(app)
      .get('/api/notes')
      .set('Authorization', `Bearer ${concurrentUserToken}`)
      .expect(401);

    assert.deepStrictEqual(profileResponse.body, {
      success: false,
      message: 'Token inválido o expirado.'
    });
    assert.deepStrictEqual(notesResponse.body, {
      success: false,
      message: 'Token inválido o expirado.'
    });
  });

  test('la cuenta eliminada no inicia sesion y el usuario demo permanece', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({
        correo: 'concurrente@quicknotes.local',
        password: DEMO_PASSWORD
      })
      .expect(401);

    const demoResponse = await request(app)
      .post('/api/auth/login')
      .send({ correo: DEMO_EMAIL, password: DEMO_PASSWORD })
      .expect(200);

    assert.strictEqual(demoResponse.body.data.user.id_usuario, 1);
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
      .set('Authorization', `Bearer ${demoToken}`)
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

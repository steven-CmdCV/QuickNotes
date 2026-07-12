PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE TRANSACTION;

INSERT OR IGNORE INTO categorias (nombre_categoria, descripcion) VALUES
  ('Academico', 'Notas relacionadas con clases, tareas y estudio'),
  ('Personal', 'Notas personales y pendientes cotidianos'),
  ('Trabajo', 'Notas relacionadas con actividades laborales'),
  ('Ideas', 'Ideas rapidas para desarrollar despues'),
  ('Recordatorios', 'Recordatorios importantes');

-- Usuario demo para pruebas academicas.
-- El password_hash es solo de prueba y no debe usarse en produccion.
INSERT OR IGNORE INTO usuarios (nombre, correo, password_hash) VALUES
  ('Usuario Demo', 'demo@quicknotes.local', 'hash_de_prueba_no_seguro');

INSERT INTO notas (id_usuario, id_categoria, titulo, contenido, es_favorita)
SELECT
  u.id_usuario,
  c.id_categoria,
  'Repasar base de datos',
  'Revisar las tablas iniciales de Quick Notes.',
  1
FROM usuarios u
JOIN categorias c ON c.nombre_categoria = 'Academico'
WHERE u.correo = 'demo@quicknotes.local'
  AND NOT EXISTS (
    SELECT 1
    FROM notas n
    WHERE n.id_usuario = u.id_usuario
      AND n.id_categoria = c.id_categoria
      AND n.titulo = 'Repasar base de datos'
      AND n.contenido = 'Revisar las tablas iniciales de Quick Notes.'
      AND n.es_favorita = 1
  );

INSERT INTO notas (id_usuario, id_categoria, titulo, contenido, es_favorita)
SELECT
  u.id_usuario,
  c.id_categoria,
  'Idea para la app',
  'Agregar busqueda de notas en una fase futura.',
  0
FROM usuarios u
JOIN categorias c ON c.nombre_categoria = 'Ideas'
WHERE u.correo = 'demo@quicknotes.local'
  AND NOT EXISTS (
    SELECT 1
    FROM notas n
    WHERE n.id_usuario = u.id_usuario
      AND n.id_categoria = c.id_categoria
      AND n.titulo = 'Idea para la app'
      AND n.contenido = 'Agregar busqueda de notas en una fase futura.'
      AND n.es_favorita = 0
  );

COMMIT;

-- Completa el proyecto de ejemplo «Distorsión» (proj-dis) de la base de
-- desarrollo para grabar la demo (/demo): reparto, equipo, desglose de todas
-- las escenas, presupuesto, storyboard y hoja enviada. Se puede repetir: todo
-- usa ids fijos («demo-…», «dis-…») y ON CONFLICT. No se usa en producción.
--   psql $DATABASE_URL -f scripts/demo/seed-distorsion.sql

BEGIN;

UPDATE "Project" SET director = 'Daniel Molina', producer = 'Bruma Films' WHERE id = 'proj-dis';

-- Reparto (nombres inventados)
INSERT INTO "Actor" (id, "projectId", name, "updatedAt") VALUES
  ('demo-act-aurel', 'proj-dis', 'Mario Ortega', now()),
  ('demo-act-dorian', 'proj-dis', 'Iván Ríos', now()),
  ('demo-act-lyra', 'proj-dis', 'Clara Vidal', now()),
  ('demo-act-camarero', 'proj-dis', 'Toni Puig', now())
ON CONFLICT (id) DO NOTHING;
UPDATE "Character" SET "actorId" = 'demo-act-aurel' WHERE "projectId" = 'proj-dis' AND name = 'AUREL';
UPDATE "Character" SET "actorId" = 'demo-act-dorian' WHERE "projectId" = 'proj-dis' AND name = 'DORIAN';
UPDATE "Character" SET "actorId" = 'demo-act-lyra' WHERE "projectId" = 'proj-dis' AND name = 'LYRA';
UPDATE "Character" SET "actorId" = 'demo-act-camarero' WHERE "projectId" = 'proj-dis' AND name = 'CAMARERO';

-- Equipo técnico
INSERT INTO "CrewMember" (id, "projectId", name, role, "updatedAt") VALUES
  ('dis-crew-1', 'proj-dis', 'Daniel Molina', 'Dirección', now()),
  ('dis-crew-2', 'proj-dis', 'Jordi Soler', 'Dirección de fotografía', now()),
  ('dis-crew-3', 'proj-dis', 'Ana Ferrer', 'Producción', now()),
  ('dis-crew-4', 'proj-dis', 'Lucía Gómez', 'Arte y vestuario', now()),
  ('dis-crew-5', 'proj-dis', 'Pau Serra', 'Sonido directo', now()),
  ('dis-crew-6', 'proj-dis', 'Marta Ruiz', 'Ayudante de dirección', now())
ON CONFLICT (id) DO NOTHING;

-- Desglose: lo que hace falta en cada escena
INSERT INTO "BreakdownElement" (id, "projectId", category, name, "updatedAt") VALUES
  ('demo-bd-raqueta', 'proj-dis', 'PROP', 'raqueta de Aurel', now()),
  ('demo-bd-cesto', 'proj-dis', 'PROP', 'cesto de pelotas', now()),
  ('demo-bd-botella', 'proj-dis', 'PROP', 'botella de agua', now()),
  ('demo-bd-movil', 'proj-dis', 'PROP', 'móvil de Lyra', now()),
  ('demo-bd-bici', 'proj-dis', 'VEHICLE', 'bicicleta roja', now()),
  ('demo-bd-traje', 'proj-dis', 'WARDROBE', 'traje azul marino', now()),
  ('demo-bd-chandal', 'proj-dis', 'WARDROBE', 'chándal blanco de Dorian', now()),
  ('demo-bd-sudor', 'proj-dis', 'MAKEUP_HAIR', 'sudor y suciedad', now()),
  ('demo-bd-humo', 'proj-dis', 'VFX', 'humo en negro', now()),
  ('demo-bd-foco', 'proj-dis', 'LIGHTING', 'foco cenital duro', now()),
  ('demo-bd-ambiente', 'proj-dis', 'SOUND', 'ambiente de restaurante', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO "SceneBreakdownElement" ("sceneId", "breakdownElementId")
SELECT s.id, e.id FROM "Scene" s JOIN (VALUES
  ('1', 'demo-bd-raqueta'), ('1', 'demo-bd-chandal'), ('1', 'demo-bd-botella'),
  ('2', 'demo-bd-ambiente'), ('2', 'demo-bd-movil'),
  ('3', 'demo-bd-bici'), ('3', 'demo-bd-traje'),
  ('4', 'demo-bd-traje'), ('4', 'demo-bd-movil'),
  ('5', 'demo-bd-ambiente'), ('5', 'demo-bd-movil'),
  ('6', 'demo-bd-movil'), ('6', 'demo-bd-traje'),
  ('7', 'demo-bd-traje'), ('7', 'demo-bd-sudor'),
  ('8', 'demo-bd-humo'), ('8', 'demo-bd-foco'),
  ('9', 'demo-bd-sudor'),
  ('10', 'demo-bd-cesto'), ('10', 'demo-bd-sudor'), ('10', 'demo-bd-foco')
) AS m(num, el) ON m.num = s.number
JOIN "BreakdownElement" e ON e.id = m.el
WHERE s."projectId" = 'proj-dis'
ON CONFLICT DO NOTHING;

-- Presupuesto
INSERT INTO "BudgetCategory" (id, "projectId", name, "order", "updatedAt") VALUES
  ('dis-bc-1', 'proj-dis', 'Equipo artístico', 0, now()),
  ('dis-bc-2', 'proj-dis', 'Equipo técnico', 1, now()),
  ('dis-bc-3', 'proj-dis', 'Material de cámara y luz', 2, now()),
  ('dis-bc-4', 'proj-dis', 'Arte y vestuario', 3, now()),
  ('dis-bc-5', 'proj-dis', 'Localizaciones y permisos', 4, now()),
  ('dis-bc-6', 'proj-dis', 'Transporte y catering', 5, now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO "BudgetItem" (id, "categoryId", description, quantity, "unitPrice", "updatedAt") VALUES
  ('dis-bi-1', 'dis-bc-1', 'Reparto principal (3 días)', 3, 450, now()),
  ('dis-bi-2', 'dis-bc-1', 'Reparto secundario', 1, 200, now()),
  ('dis-bi-3', 'dis-bc-2', 'Equipo técnico (6 personas · 3 días)', 18, 120, now()),
  ('dis-bi-4', 'dis-bc-3', 'Alquiler cámara y ópticas', 3, 380, now()),
  ('dis-bi-5', 'dis-bc-3', 'Kit de iluminación', 3, 220, now()),
  ('dis-bi-6', 'dis-bc-4', 'Vestuario y atrezzo', 1, 650, now()),
  ('dis-bi-7', 'dis-bc-5', 'Pista de tenis y restaurante', 2, 300, now()),
  ('dis-bi-8', 'dis-bc-6', 'Furgoneta y catering', 3, 260, now())
ON CONFLICT (id) DO NOTHING;
UPDATE "Project" SET "budgetTarget" = 8500 WHERE id = 'proj-dis';

-- Storyboard: una viñeta para los primeros planos (fotogramas del proyecto)
INSERT INTO "StoryboardFrame" (id, "shotId", "imageUrl", description, "updatedAt")
SELECT 'demo-sb-' || s.id, s.id, img.url, 'Viñeta', now()
FROM (VALUES
  ('demo-dis-1-1', '/images/projects/distorsion/frame-01.jpg'),
  ('demo-dis-1-2', '/images/projects/distorsion/frame-02.jpg'),
  ('demo-dis-1-3', '/images/projects/distorsion/bts-04.jpg'),
  ('demo-dis-2-1', '/images/projects/distorsion/bts-01.jpg'),
  ('demo-dis-2-2', '/images/projects/distorsion/bts-06.jpg'),
  ('demo-dis-7-1', '/images/projects/distorsion/bts-03.jpg'),
  ('demo-dis-7-2', '/images/projects/distorsion/bts-07.jpg'),
  ('demo-dis-8-1', '/images/projects/distorsion/bts-05.jpg'),
  ('demo-dis-10-1', '/images/projects/distorsion/bts-02.jpg')
) AS img(shot, url)
JOIN "Shot" s ON s.id = img.shot
ON CONFLICT (id) DO NOTHING;

-- La hoja de llamada del día 1, ya enviada
UPDATE "ShootingDay" SET "shareToken" = 'demo-hoja-dia-1' WHERE id = 'cmv8khmwh00017dedhtn13azp' AND "shareToken" IS NULL;

COMMIT;

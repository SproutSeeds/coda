ALTER TABLE "idea_features"
ADD COLUMN "detail_sections" jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE "idea_features"
SET "detail_sections" = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid(),
    'label', COALESCE(NULLIF("detail_label", ''), 'Detail'),
    'body', "detail",
    'position', 1000
  )
)
WHERE COALESCE(TRIM("detail"), '') <> '';

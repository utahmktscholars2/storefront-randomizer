-- Remove duplicate rows that were created before assignments used upsert().
-- Keep the earliest assignment for each shop/experiment/visitor/session/page tuple.
DELETE FROM "ab_assignments" a
USING "ab_assignments" b
WHERE a."id" > b."id"
  AND a."shop" IS NOT DISTINCT FROM b."shop"
  AND a."experiment_key" = b."experiment_key"
  AND a."visitor_id" = b."visitor_id"
  AND a."session_id" IS NOT DISTINCT FROM b."session_id"
  AND a."page_url" IS NOT DISTINCT FROM b."page_url";

-- Add the unique constraint required by prisma.abAssignment.upsert().
CREATE UNIQUE INDEX "ab_assignments_shop_experiment_key_visitor_id_session_id_page_url_key"
ON "ab_assignments"("shop", "experiment_key", "visitor_id", "session_id", "page_url");

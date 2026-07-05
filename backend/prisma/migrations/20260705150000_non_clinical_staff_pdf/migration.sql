-- Non-clinical staff categories + staff clearance workflow
ALTER TABLE "staff_categories" ADD COLUMN "requiresCommitteeReview" BOOLEAN NOT NULL DEFAULT true;

-- Job description upload & clinical unit support

ALTER TABLE "job_descriptions" ADD COLUMN "clinicalUnit" TEXT NOT NULL DEFAULT '';
ALTER TABLE "job_descriptions" ADD COLUMN "sourceFileName" TEXT;
ALTER TABLE "job_descriptions" ADD COLUMN "sourceFilePath" TEXT;
ALTER TABLE "job_descriptions" ADD COLUMN "sourceMimeType" TEXT;
ALTER TABLE "job_descriptions" ADD COLUMN "extractedText" TEXT;
ALTER TABLE "job_descriptions" ADD COLUMN "aiParsedAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "job_descriptions_subtypeId_key";
CREATE UNIQUE INDEX "job_descriptions_subtypeId_clinicalUnit_key" ON "job_descriptions"("subtypeId", "clinicalUnit");

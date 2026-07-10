-- DPDP / security: consent fields, document encryption flag, erasure request
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consentAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "consentVersion" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "privacyNoticeAccepted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "erasureRequestedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "erasureCompletedAt" TIMESTAMP(3);

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "isEncrypted" BOOLEAN NOT NULL DEFAULT false;

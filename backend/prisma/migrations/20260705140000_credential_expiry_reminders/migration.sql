-- Credential expiry reminder deduplication log

CREATE TABLE "credential_expiry_reminders" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_expiry_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credential_expiry_reminders_credentialId_ruleId_key" ON "credential_expiry_reminders"("credentialId", "ruleId");
CREATE INDEX "credential_expiry_reminders_sentAt_idx" ON "credential_expiry_reminders"("sentAt");

ALTER TABLE "credential_expiry_reminders" ADD CONSTRAINT "credential_expiry_reminders_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

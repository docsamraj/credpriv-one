-- Clinical unit on applications and committee meeting MoM distribution

ALTER TABLE "applications" ADD COLUMN "clinicalUnit" TEXT NOT NULL DEFAULT '';

ALTER TABLE "committee_meetings" ADD COLUMN "minutesPreparedAt" TIMESTAMP(3);
ALTER TABLE "committee_meetings" ADD COLUMN "minutesSentAt" TIMESTAMP(3);
ALTER TABLE "committee_meetings" ADD COLUMN "presentMemberIds" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "committee_meetings" ADD COLUMN "additionalRecipients" JSONB NOT NULL DEFAULT '[]';

-- Committee member roster: degrees, designation, engagement period, expanded roles

ALTER TABLE "committee_members" ADD COLUMN "memberName" TEXT;
ALTER TABLE "committee_members" ADD COLUMN "degrees" TEXT;
ALTER TABLE "committee_members" ADD COLUMN "designation" TEXT;
ALTER TABLE "committee_members" ADD COLUMN "engagementStart" TIMESTAMP(3);
ALTER TABLE "committee_members" ADD COLUMN "engagementEnd" TIMESTAMP(3);
ALTER TABLE "committee_members" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "committee_members" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "committee_members" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "committee_members" ALTER COLUMN "role" SET DEFAULT 'MEMBER';
ALTER TABLE "committee_members" ALTER COLUMN "role" SET NOT NULL;

-- Drop old FK to allow nullable userId with SET NULL on delete
ALTER TABLE "committee_members" DROP CONSTRAINT IF EXISTS "committee_members_userId_fkey";
ALTER TABLE "committee_members" ADD CONSTRAINT "committee_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "committee_members_committeeId_idx" ON "committee_members"("committeeId");

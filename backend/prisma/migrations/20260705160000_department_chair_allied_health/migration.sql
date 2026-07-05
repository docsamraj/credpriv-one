-- Department chair assignment for non-clinical approval workflow
ALTER TABLE "departments" ADD COLUMN "chairUserId" TEXT;
ALTER TABLE "departments" ADD CONSTRAINT "departments_chairUserId_fkey" FOREIGN KEY ("chairUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

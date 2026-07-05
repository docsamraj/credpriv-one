-- Rich committee review packet support + background verification tracking

CREATE TABLE "third_party_verifiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pinCode" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "mouReference" TEXT,
    "mouValidFrom" TIMESTAMP(3),
    "mouValidTo" TIMESTAMP(3),
    "mouDocumentPath" TEXT,
    "servicesOffered" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "third_party_verifiers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "background_verifications" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "verificationType" TEXT NOT NULL DEFAULT 'BACKGROUND_CHECK',
    "verifierType" TEXT NOT NULL,
    "performedByUserId" TEXT,
    "thirdPartyVerifierId" TEXT,
    "thirdPartyName" TEXT,
    "thirdPartyAddress" TEXT,
    "mouReference" TEXT,
    "mouDocumentPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "findings" TEXT,
    "remarks" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "background_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "background_verifications_applicationId_idx" ON "background_verifications"("applicationId");
CREATE INDEX "background_verifications_status_idx" ON "background_verifications"("status");

ALTER TABLE "background_verifications" ADD CONSTRAINT "background_verifications_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "background_verifications" ADD CONSTRAINT "background_verifications_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "background_verifications" ADD CONSTRAINT "background_verifications_thirdPartyVerifierId_fkey" FOREIGN KEY ("thirdPartyVerifierId") REFERENCES "third_party_verifiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

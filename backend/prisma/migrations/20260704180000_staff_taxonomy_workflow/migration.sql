-- Staff taxonomy, job descriptions, and workflow phases

-- AlterTable
ALTER TABLE "applications" ADD COLUMN "workflowPhase" TEXT NOT NULL DEFAULT 'APPOINTMENT';
ALTER TABLE "applications" ADD COLUMN "staffCategoryId" TEXT;
ALTER TABLE "applications" ADD COLUMN "staffSubtypeId" TEXT;
ALTER TABLE "applications" ADD COLUMN "jobDescriptionId" TEXT;
ALTER TABLE "applications" ADD COLUMN "credentialingCompleteAt" TIMESTAMP(3);
ALTER TABLE "applications" ADD COLUMN "privilegeRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "provider_profiles" ADD COLUMN "staffCategoryId" TEXT;
ALTER TABLE "provider_profiles" ADD COLUMN "staffSubtypeId" TEXT;

-- AlterTable
ALTER TABLE "required_documents" ADD COLUMN "staffCategoryId" TEXT;
ALTER TABLE "required_documents" ADD COLUMN "staffSubtypeId" TEXT;

-- CreateTable
CREATE TABLE "staff_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_subtypes" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentGroup" TEXT,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_subtypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_descriptions" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "subtypeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_description_items" (
    "id" TEXT NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "defaultLevel" TEXT NOT NULL DEFAULT 'NONE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_description_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_privilege_requests" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "jobDescriptionItemId" TEXT NOT NULL,
    "requestedLevel" TEXT NOT NULL,
    "grantedLevel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "grantedAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_privilege_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_categories_code_key" ON "staff_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_subtypes_code_key" ON "staff_subtypes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "job_descriptions_subtypeId_key" ON "job_descriptions"("subtypeId");

-- CreateIndex
CREATE INDEX "applications_workflowPhase_idx" ON "applications"("workflowPhase");

-- CreateIndex
CREATE INDEX "application_privilege_requests_applicationId_idx" ON "application_privilege_requests"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_privilege_requests_applicationId_jobDescriptionItemId_key" ON "application_privilege_requests"("applicationId", "jobDescriptionItemId");

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_staffCategoryId_fkey" FOREIGN KEY ("staffCategoryId") REFERENCES "staff_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_profiles" ADD CONSTRAINT "provider_profiles_staffSubtypeId_fkey" FOREIGN KEY ("staffSubtypeId") REFERENCES "staff_subtypes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_staffCategoryId_fkey" FOREIGN KEY ("staffCategoryId") REFERENCES "staff_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_staffSubtypeId_fkey" FOREIGN KEY ("staffSubtypeId") REFERENCES "staff_subtypes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "required_documents" ADD CONSTRAINT "required_documents_staffCategoryId_fkey" FOREIGN KEY ("staffCategoryId") REFERENCES "staff_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "required_documents" ADD CONSTRAINT "required_documents_staffSubtypeId_fkey" FOREIGN KEY ("staffSubtypeId") REFERENCES "staff_subtypes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_subtypes" ADD CONSTRAINT "staff_subtypes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "staff_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "staff_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_subtypeId_fkey" FOREIGN KEY ("subtypeId") REFERENCES "staff_subtypes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_description_items" ADD CONSTRAINT "job_description_items_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_privilege_requests" ADD CONSTRAINT "application_privilege_requests_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_privilege_requests" ADD CONSTRAINT "application_privilege_requests_jobDescriptionItemId_fkey" FOREIGN KEY ("jobDescriptionItemId") REFERENCES "job_description_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

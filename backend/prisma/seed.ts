import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedStaffCatalog } from '../src/lib/seed-staff-catalog';
import { DoctorSubtype } from '@credpriv/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CredPriv One database...');

  const staffTable = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'staff_categories'
    ) AS "exists"
  `;
  if (!staffTable[0]?.exists) {
    console.error('Missing staff_categories table. Run first: npx prisma migrate deploy');
    process.exit(1);
  }

  const { categoryIds, subtypeIds } = await seedStaffCatalog(prisma);

  const cardiology = await prisma.department.upsert({
    where: { name: 'Cardiology' },
    update: {},
    create: { name: 'Cardiology', code: 'CARD', description: 'Cardiology & Cardiac Surgery' },
  });

  await prisma.department.upsert({
    where: { name: 'General Surgery' },
    update: {},
    create: { name: 'General Surgery', code: 'SURG' },
  });

  await prisma.department.upsert({
    where: { name: 'Emergency Medicine' },
    update: {},
    create: { name: 'Emergency Medicine', code: 'EM' },
  });

  const interventional = await prisma.specialty.upsert({
    where: { name_departmentId: { name: 'Interventional Cardiology', departmentId: cardiology.id } },
    update: {},
    create: { name: 'Interventional Cardiology', code: 'IC', departmentId: cardiology.id },
  });

  await prisma.specialty.upsert({
    where: { name_departmentId: { name: 'Cardiac Surgery', departmentId: cardiology.id } },
    update: {},
    create: { name: 'Cardiac Surgery', code: 'CS', departmentId: cardiology.id },
  });

  const stages = [
    { name: 'Draft', order: 1 },
    { name: 'Submitted', order: 2 },
    { name: 'Under Verification', order: 3 },
    { name: 'Committee Review', order: 4 },
    { name: 'MEC Review', order: 5 },
    { name: 'Board Approval', order: 6 },
    { name: 'Approved', order: 7 },
  ];

  for (const stage of stages) {
    await prisma.workflowStage.upsert({
      where: { order: stage.order },
      update: {},
      create: stage,
    });
  }

  const credCommittee = await prisma.committee.upsert({
    where: { id: 'seed-cred-committee' },
    update: {},
    create: {
      id: 'seed-cred-committee',
      name: 'Credentialing Committee',
      type: 'CREDENTIALING',
      description: 'Primary credentialing review committee',
    },
  });

  await prisma.committee.upsert({
    where: { id: 'seed-mec' },
    update: {},
    create: { id: 'seed-mec', name: 'Medical Executive Committee', type: 'MEC' },
  });

  await prisma.committee.upsert({
    where: { id: 'seed-board' },
    update: {},
    create: { id: 'seed-board', name: 'Board of Directors', type: 'BOARD' },
  });

  const existingCathCategory = await prisma.privilegeCategory.findFirst({
    where: { name: 'Cardiac Catheterization', departmentId: cardiology.id },
  });
  if (!existingCathCategory) {
    await prisma.privilegeCategory.create({
      data: {
        name: 'Cardiac Catheterization',
        departmentId: cardiology.id,
        procedures: {
          create: [
            { name: 'Diagnostic Cardiac Catheterization', code: 'CATH-DX', privilegeLevel: 'FULL' },
            { name: 'Percutaneous Coronary Intervention (PCI)', code: 'CATH-PCI', privilegeLevel: 'FULL' },
            { name: 'Structural Heart Intervention', code: 'CATH-STRUCT', privilegeLevel: 'LIMITED' },
          ],
        },
      },
    });
  }

  const legacyDocCount = await prisma.requiredDocument.count({
    where: { specialtyId: interventional.id, staffCategoryId: null },
  });
  if (legacyDocCount === 0) {
    const docTypes = [
      { name: 'Medical License', type: 'LICENSE', sortOrder: 1 },
      { name: 'Medical Degree', type: 'DEGREE', sortOrder: 2 },
      { name: 'Board Certification', type: 'CERTIFICATION', sortOrder: 3 },
      { name: 'Malpractice Insurance', type: 'INSURANCE', sortOrder: 4 },
      { name: 'Government ID', type: 'IDENTITY', sortOrder: 5 },
      { name: 'DEA Certificate', type: 'CERTIFICATION', sortOrder: 6 },
    ];
    await prisma.requiredDocument.createMany({
      data: docTypes.map((doc) => ({ ...doc, specialtyId: interventional.id })),
    });
  }

  const passwordHash = await bcrypt.hash('Password123!', 12);

  await prisma.user.upsert({
    where: { email: 'admin@credpriv.hospital' },
    update: {},
    create: {
      email: 'admin@credpriv.hospital',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      roles: { create: { role: 'SYSTEM_ADMIN' } },
    },
  });

  await prisma.user.upsert({
    where: { email: 'staff@credpriv.hospital' },
    update: {},
    create: {
      email: 'staff@credpriv.hospital',
      passwordHash,
      firstName: 'Sarah',
      lastName: 'Credentialing',
      roles: { create: { role: 'CREDENTIALING_STAFF' } },
    },
  });

  const committeeMember = await prisma.user.upsert({
    where: { email: 'committee@credpriv.hospital' },
    update: {},
    create: {
      email: 'committee@credpriv.hospital',
      passwordHash,
      firstName: 'Dr. James',
      lastName: 'Wilson',
      roles: { create: { role: 'COMMITTEE_MEMBER' } },
    },
  });

  await prisma.committeeMember.upsert({
    where: {
      committeeId_userId: { committeeId: credCommittee.id, userId: committeeMember.id },
    },
    update: { role: 'CHAIR', isActive: true },
    create: { committeeId: credCommittee.id, userId: committeeMember.id, role: 'CHAIR' },
  });

  const providerUser = await prisma.user.upsert({
    where: { email: 'provider@credpriv.hospital' },
    update: {},
    create: {
      email: 'provider@credpriv.hospital',
      passwordHash,
      firstName: 'Raj',
      lastName: 'Sharma',
      roles: { create: { role: 'PROVIDER' } },
      provider: {
        create: {
          npi: '1234567890',
          licenseNo: 'MED-2024-001',
          profile: {
            create: {
              departmentId: cardiology.id,
              specialtyId: interventional.id,
              staffCategoryId: categoryIds.DOCTOR,
              staffSubtypeId: subtypeIds[DoctorSubtype.FULL_TIME_CONSULTANT],
              phone: '+91-9876543210',
              employmentType: 'FULL_TIME',
            },
          },
        },
      },
    },
    include: { provider: true },
  });

  let provider = providerUser.provider;
  if (!provider) {
    provider = await prisma.provider.upsert({
      where: { userId: providerUser.id },
      update: {},
      create: {
        userId: providerUser.id,
        npi: '1234567890',
        licenseNo: 'MED-2024-001',
      },
    });
  }

  await prisma.providerProfile.upsert({
    where: { providerId: provider.id },
    update: {
      staffCategoryId: categoryIds.DOCTOR,
      staffSubtypeId: subtypeIds[DoctorSubtype.FULL_TIME_CONSULTANT],
      departmentId: cardiology.id,
      specialtyId: interventional.id,
    },
    create: {
      providerId: provider.id,
      departmentId: cardiology.id,
      specialtyId: interventional.id,
      staffCategoryId: categoryIds.DOCTOR,
      staffSubtypeId: subtypeIds[DoctorSubtype.FULL_TIME_CONSULTANT],
      phone: '+91-9876543210',
      employmentType: 'FULL_TIME',
    },
  });

  const credentialCount = await prisma.credential.count({ where: { providerId: provider.id } });
  if (credentialCount === 0) {
    await prisma.credential.createMany({
      data: [
        {
          providerId: provider.id,
          type: 'LICENSE',
          title: 'State Medical License',
          issuingBody: 'Medical Council',
          identifier: 'MED-2024-001',
          issueDate: new Date('2020-01-15'),
          expiryDate: new Date('2026-12-31'),
          status: 'VERIFIED',
          verifiedAt: new Date(),
        },
        {
          providerId: provider.id,
          type: 'CERTIFICATION',
          title: 'Board Certification - Cardiology',
          issuingBody: 'American Board of Internal Medicine',
          expiryDate: new Date('2025-06-30'),
          status: 'PENDING',
        },
      ],
    });
  }

  const appCount = await prisma.application.count({ where: { providerId: provider.id } });
  if (appCount === 0) {
    await prisma.application.create({
      data: {
        providerId: provider.id,
        type: 'INITIAL_APPOINTMENT',
        status: 'SUBMITTED',
        workflowPhase: 'DOCUMENT_UPLOAD',
        currentStage: 'DOCUMENT_UPLOAD',
        staffCategoryId: categoryIds.DOCTOR,
        staffSubtypeId: subtypeIds[DoctorSubtype.FULL_TIME_CONSULTANT],
        submittedAt: new Date(),
      },
    });
  }

  const ruleCount = await prisma.notificationRule.count();
  if (ruleCount === 0) {
    await prisma.notificationRule.createMany({
      data: [
        { name: 'Credential Expiry 30 days', event: 'CREDENTIAL_EXPIRING', channel: 'EMAIL', daysBefore: 30 },
        { name: 'Credential Expiry 60 days', event: 'CREDENTIAL_EXPIRING', channel: 'EMAIL', daysBefore: 60 },
        { name: 'Application Status Change', event: 'APPLICATION_STATUS_CHANGED', channel: 'IN_APP' },
      ],
    });
  }

  console.log('Seed complete!');
  console.log('Demo accounts (password: Password123!):');
  console.log('  admin@credpriv.hospital — System Admin');
  console.log('  staff@credpriv.hospital — Credentialing Staff');
  console.log('  committee@credpriv.hospital — Committee Member');
  console.log('  provider@credpriv.hospital — Provider');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

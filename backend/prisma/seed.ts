import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CredPriv One database...');

  // Departments
  const cardiology = await prisma.department.upsert({
    where: { name: 'Cardiology' },
    update: {},
    create: { name: 'Cardiology', code: 'CARD', description: 'Cardiology & Cardiac Surgery' },
  });

  const surgery = await prisma.department.upsert({
    where: { name: 'General Surgery' },
    update: {},
    create: { name: 'General Surgery', code: 'SURG' },
  });

  const emergency = await prisma.department.upsert({
    where: { name: 'Emergency Medicine' },
    update: {},
    create: { name: 'Emergency Medicine', code: 'EM' },
  });

  // Specialties
  const interventional = await prisma.specialty.upsert({
    where: { name_departmentId: { name: 'Interventional Cardiology', departmentId: cardiology.id } },
    update: {},
    create: { name: 'Interventional Cardiology', code: 'IC', departmentId: cardiology.id },
  });

  const cardiacSurgery = await prisma.specialty.upsert({
    where: { name_departmentId: { name: 'Cardiac Surgery', departmentId: cardiology.id } },
    update: {},
    create: { name: 'Cardiac Surgery', code: 'CS', departmentId: cardiology.id },
  });

  // Workflow stages
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

  // Committees
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

  const mec = await prisma.committee.upsert({
    where: { id: 'seed-mec' },
    update: {},
    create: {
      id: 'seed-mec',
      name: 'Medical Executive Committee',
      type: 'MEC',
    },
  });

  const board = await prisma.committee.upsert({
    where: { id: 'seed-board' },
    update: {},
    create: {
      id: 'seed-board',
      name: 'Board of Directors',
      type: 'BOARD',
    },
  });

  // Privilege categories & procedures
  const cathCategory = await prisma.privilegeCategory.create({
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

  // Required documents
  const docTypes = [
    { name: 'Medical License', type: 'LICENSE', sortOrder: 1 },
    { name: 'Medical Degree', type: 'DEGREE', sortOrder: 2 },
    { name: 'Board Certification', type: 'CERTIFICATION', sortOrder: 3 },
    { name: 'Malpractice Insurance', type: 'INSURANCE', sortOrder: 4 },
    { name: 'Government ID', type: 'IDENTITY', sortOrder: 5 },
    { name: 'DEA Certificate', type: 'CERTIFICATION', sortOrder: 6 },
  ];

  for (const doc of docTypes) {
    await prisma.requiredDocument.create({
      data: { ...doc, specialtyId: interventional.id },
    });
  }

  // Demo users
  const passwordHash = await bcrypt.hash('Password123!', 12);

  const admin = await prisma.user.upsert({
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

  const staff = await prisma.user.upsert({
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

  await prisma.committeeMember.create({
    data: { committeeId: credCommittee.id, userId: committeeMember.id, role: 'CHAIR' },
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
              phone: '+91-9876543210',
              employmentType: 'FULL_TIME',
            },
          },
        },
      },
    },
    include: { provider: true },
  });

  // Sample credentials for provider
  if (providerUser.provider) {
    await prisma.credential.createMany({
      data: [
        {
          providerId: providerUser.provider.id,
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
          providerId: providerUser.provider.id,
          type: 'CERTIFICATION',
          title: 'Board Certification - Cardiology',
          issuingBody: 'American Board of Internal Medicine',
          expiryDate: new Date('2025-06-30'),
          status: 'PENDING',
        },
      ],
    });

    await prisma.application.create({
      data: {
        providerId: providerUser.provider.id,
        type: 'INITIAL_APPOINTMENT',
        status: 'UNDER_VERIFICATION',
        currentStage: 'UNDER_VERIFICATION',
        submittedAt: new Date(),
      },
    });
  }

  // Notification rules
  await prisma.notificationRule.createMany({
    data: [
      { name: 'Credential Expiry 30 days', event: 'CREDENTIAL_EXPIRING', channel: 'EMAIL', daysBefore: 30 },
      { name: 'Credential Expiry 60 days', event: 'CREDENTIAL_EXPIRING', channel: 'EMAIL', daysBefore: 60 },
      { name: 'Application Status Change', event: 'APPLICATION_STATUS_CHANGED', channel: 'IN_APP' },
    ],
  });

  console.log('Seed complete!');
  console.log('Demo accounts (password: Password123!):');
  console.log('  admin@credpriv.hospital — System Admin');
  console.log('  staff@credpriv.hospital — Credentialing Staff');
  console.log('  committee@credpriv.hospital — Committee Member');
  console.log('  provider@credpriv.hospital — Provider');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

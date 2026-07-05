import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedStaffCatalog } from '../src/lib/seed-staff-catalog';
import { DoctorSubtype, AlliedHealthSubtype, HrSubtype, HousekeepingSubtype } from '@credpriv/shared';

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

  const alliedHealthDept = await prisma.department.upsert({
    where: { name: 'Allied Health' },
    update: {},
    create: { name: 'Allied Health', code: 'ALLIED', description: 'Physiotherapy, Pharmacy, Radiology, Dietetics' },
  });

  const hrDept = await prisma.department.upsert({
    where: { name: 'Human Resources' },
    update: {},
    create: { name: 'Human Resources', code: 'HR', description: 'HR and employee onboarding' },
  });

  const housekeepingDept = await prisma.department.upsert({
    where: { name: 'Housekeeping' },
    update: {},
    create: { name: 'Housekeeping', code: 'HK', description: 'Housekeeping and sanitation services' },
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
    update: {
      role: 'CHAIR',
      designation: 'Head of Credentialing',
      degrees: 'MBBS, MD',
      engagementStart: new Date('2024-01-01'),
      engagementEnd: new Date('2026-12-31'),
      isActive: true,
    },
    create: {
      committeeId: credCommittee.id,
      userId: committeeMember.id,
      role: 'CHAIR',
      designation: 'Head of Credentialing',
      degrees: 'MBBS, MD',
      engagementStart: new Date('2024-01-01'),
      engagementEnd: new Date('2026-12-31'),
    },
  });

  const staffUser = await prisma.user.findUnique({ where: { email: 'staff@credpriv.hospital' } });
  if (staffUser) {
    await prisma.committeeMember.upsert({
      where: {
        committeeId_userId: { committeeId: credCommittee.id, userId: staffUser.id },
      },
      update: { role: 'SECRETARY', designation: 'Credentialing Secretary', isActive: true },
      create: {
        committeeId: credCommittee.id,
        userId: staffUser.id,
        role: 'SECRETARY',
        designation: 'Credentialing Secretary',
        engagementStart: new Date('2024-01-01'),
        engagementEnd: new Date('2026-12-31'),
      },
    });
  }

  const meetingAt = new Date();
  meetingAt.setDate(meetingAt.getDate() + 7);
  await prisma.committeeMeeting.upsert({
    where: { id: 'seed-cred-meeting-1' },
    update: { scheduledAt: meetingAt, status: 'SCHEDULED' },
    create: {
      id: 'seed-cred-meeting-1',
      committeeId: credCommittee.id,
      title: 'Monthly Credentialing Review',
      scheduledAt: meetingAt,
      location: 'Conference Room A',
      status: 'SCHEDULED',
      agenda: 'Review pending privilege requests and new appointments',
    },
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

  async function ensureApplicant(opts: {
    email: string;
    firstName: string;
    lastName: string;
    departmentId: string;
    staffCategoryId: string;
    staffSubtypeId: string;
    workflowPhase?: string;
    licenseNo?: string;
  }) {
    const user = await prisma.user.upsert({
      where: { email: opts.email },
      update: {},
      create: {
        email: opts.email,
        passwordHash,
        firstName: opts.firstName,
        lastName: opts.lastName,
        roles: { create: { role: 'PROVIDER' } },
      },
    });

    let prov = await prisma.provider.findUnique({ where: { userId: user.id } });
    if (!prov) {
      prov = await prisma.provider.create({
        data: { userId: user.id, licenseNo: opts.licenseNo },
      });
    }

    await prisma.providerProfile.upsert({
      where: { providerId: prov.id },
      update: {
        departmentId: opts.departmentId,
        staffCategoryId: opts.staffCategoryId,
        staffSubtypeId: opts.staffSubtypeId,
        employmentType: 'FULL_TIME',
      },
      create: {
        providerId: prov.id,
        departmentId: opts.departmentId,
        staffCategoryId: opts.staffCategoryId,
        staffSubtypeId: opts.staffSubtypeId,
        employmentType: 'FULL_TIME',
      },
    });

    const existing = await prisma.application.count({ where: { providerId: prov.id } });
    if (existing === 0) {
      await prisma.application.create({
        data: {
          providerId: prov.id,
          type: 'INITIAL_APPOINTMENT',
          status: 'SUBMITTED',
          workflowPhase: opts.workflowPhase || 'DOCUMENT_UPLOAD',
          currentStage: opts.workflowPhase || 'DOCUMENT_UPLOAD',
          staffCategoryId: opts.staffCategoryId,
          staffSubtypeId: opts.staffSubtypeId,
          submittedAt: new Date(),
        },
      });
    }
  }

  await ensureApplicant({
    email: 'allied@credpriv.hospital',
    firstName: 'Priya',
    lastName: 'Menon',
    departmentId: alliedHealthDept.id,
    staffCategoryId: categoryIds.ALLIED_HEALTH,
    staffSubtypeId: subtypeIds[AlliedHealthSubtype.PHYSIOTHERAPIST],
    licenseNo: 'PT-2024-014',
  });

  await ensureApplicant({
    email: 'hr@credpriv.hospital',
    firstName: 'Anita',
    lastName: 'Desai',
    departmentId: hrDept.id,
    staffCategoryId: categoryIds.HR,
    staffSubtypeId: subtypeIds[HrSubtype.HR_EXECUTIVE],
  });

  await ensureApplicant({
    email: 'housekeeping@credpriv.hospital',
    firstName: 'Ramesh',
    lastName: 'Kumar',
    departmentId: housekeepingDept.id,
    staffCategoryId: categoryIds.HOUSEKEEPING,
    staffSubtypeId: subtypeIds[HousekeepingSubtype.HOUSEKEEPING_STAFF],
  });

  const deptChair = await prisma.user.upsert({
    where: { email: 'deptchair@credpriv.hospital' },
    update: {},
    create: {
      email: 'deptchair@credpriv.hospital',
      passwordHash,
      firstName: 'Vikram',
      lastName: 'Mehta',
      roles: { create: { role: 'DEPARTMENT_CHAIR' } },
    },
  });

  await prisma.department.update({
    where: { id: hrDept.id },
    data: { chairUserId: deptChair.id },
  });
  await prisma.department.update({
    where: { id: housekeepingDept.id },
    data: { chairUserId: deptChair.id },
  });

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

  await prisma.integrationSystem.upsert({
    where: { code: 'HOSPITAL_HIS' },
    update: { name: 'Hospital Information System', systemType: 'HIS', isActive: true },
    create: {
      code: 'HOSPITAL_HIS',
      name: 'Hospital Information System',
      systemType: 'HIS',
      metadata: { description: 'Placeholder for HIS/EMR interoperability — map external IDs via /api/integrations/external-ids' },
    },
  });

  await prisma.integrationSystem.upsert({
    where: { code: 'NABH_REGISTRY' },
    update: { name: 'NABH Accreditation Registry', systemType: 'NABH', isActive: true },
    create: {
      code: 'NABH_REGISTRY',
      name: 'NABH Accreditation Registry',
      systemType: 'NABH',
      metadata: { description: 'Reserved for NABH quality accreditation data exchange' },
    },
  });

  await prisma.thirdPartyVerifier.upsert({
    where: { id: 'seed-bg-agency-1' },
    update: {},
    create: {
      id: 'seed-bg-agency-1',
      name: 'SecureVerify Background Services Pvt Ltd',
      address: '402, Business Park, Andheri East',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400069',
      contactPerson: 'Verification Desk',
      contactPhone: '+91-22-4000-1234',
      contactEmail: 'credentialing@secureverify.in',
      mouReference: 'MOU/HR/BGV/2024-018',
      mouValidFrom: new Date('2024-04-01'),
      mouValidTo: new Date('2026-03-31'),
      servicesOffered: 'Background check, criminal record, employment verification',
      notes: 'Approved third-party agency for provider background verification',
    },
  });

  console.log('Seed complete!');
  console.log('Demo accounts (password: Password123!):');
  console.log('  admin@credpriv.hospital — System Admin');
  console.log('  staff@credpriv.hospital — Credentialing Staff');
  console.log('  committee@credpriv.hospital — Committee Member');
  console.log('  provider@credpriv.hospital — Doctor (clinical / committee)');
  console.log('  allied@credpriv.hospital — Allied Health Physiotherapist (clinical / committee)');
  console.log('  hr@credpriv.hospital — HR Executive (non-clinical / dept approval)');
  console.log('  housekeeping@credpriv.hospital — Housekeeping Staff (non-clinical / dept approval)');
  console.log('  deptchair@credpriv.hospital — Department Head (HR + Housekeeping)');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

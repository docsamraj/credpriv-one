import {
  StaffCategory,
  DoctorSubtype,
  NurseSubtype,
  TechnicianSubtype,
  AlliedHealthSubtype,
  STAFF_SUBTYPES,
  BASE_EDUCATION_DOCS,
  DOCTOR_EXTRA_DOCS,
  NURSE_EXTRA_DOCS,
  TECHNICIAN_EXTRA_DOCS,
  ALLIED_HEALTH_EXTRA_DOCS,
  NON_CLINICAL_DOCS,
  PrivilegeGrantLevel,
  categoryRequiresCommittee,
} from '@credpriv/shared';
import { PrismaClient } from '@prisma/client';

type PrismaTx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/** Job description privilege line items per staff subtype */
const JOB_DESCRIPTION_TEMPLATES: Record<string, { title: string; items: { name: string; code: string; defaultLevel: string }[] }> = {
  [DoctorSubtype.FULL_TIME_CONSULTANT]: {
    title: 'Full Time Consultant — Clinical Privileges',
    items: [
      { name: 'Independent outpatient consultation', code: 'OPD_INDEPENDENT', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Inpatient admission & management', code: 'IPD_MANAGEMENT', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Surgical procedures (department scope)', code: 'SURGERY', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'ICU/CCU admission authority', code: 'CRITICAL_CARE_ADMIT', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Teaching & supervision of RMOs', code: 'TEACHING', defaultLevel: PrivilegeGrantLevel.FULL },
    ],
  },
  [DoctorSubtype.VISITING_CONSULTANT]: {
    title: 'Visiting Consultant — Clinical Privileges',
    items: [
      { name: 'Outpatient consultation (scheduled)', code: 'OPD_VISITING', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Inpatient consultation (on referral)', code: 'IPD_CONSULT', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Procedures (pre-approved list)', code: 'PROCEDURES', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Emergency on-call coverage', code: 'EMERGENCY_ONCALL', defaultLevel: PrivilegeGrantLevel.NONE },
    ],
  },
  [DoctorSubtype.ASSOCIATE_CONSULTANT]: {
    title: 'Associate Consultant — Clinical Privileges',
    items: [
      { name: 'Outpatient consultation', code: 'OPD', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Inpatient management (under consultant)', code: 'IPD_SUPERVISED', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Minor procedures', code: 'MINOR_PROCEDURES', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Independent surgical privileges', code: 'SURGERY_INDEPENDENT', defaultLevel: PrivilegeGrantLevel.NONE },
    ],
  },
  [DoctorSubtype.RMO]: {
    title: 'RMO — Clinical Privileges',
    items: [
      { name: 'Ward patient management', code: 'WARD_MANAGEMENT', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Emergency first response', code: 'EMERGENCY_FIRST', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Procedure assistance', code: 'PROCEDURE_ASSIST', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Independent prescribing', code: 'PRESCRIBING', defaultLevel: PrivilegeGrantLevel.NONE },
    ],
  },
  [NurseSubtype.SENIOR_NURSE]: {
    title: 'Senior Nurse — Nursing Privileges',
    items: [
      { name: 'Medication administration (IV/IM/SC)', code: 'MED_ADMIN', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Patient assessment & care planning', code: 'ASSESSMENT', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Supervision of junior nurses', code: 'NURSE_SUPERVISION', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Critical care nursing (ICU/CCU)', code: 'CRITICAL_CARE', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [NurseSubtype.FRESHER_NURSE]: {
    title: 'Fresher Nurse — Nursing Privileges',
    items: [
      { name: 'Basic patient care & vitals', code: 'BASIC_CARE', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Medication administration', code: 'MED_ADMIN', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'IV cannulation & fluids', code: 'IV_THERAPY', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Independent critical care duties', code: 'CRITICAL_CARE', defaultLevel: PrivilegeGrantLevel.NONE },
    ],
  },
  [TechnicianSubtype.CSSD]: {
    title: 'CSSD Technician — Technical Privileges',
    items: [
      { name: 'Sterilization equipment operation', code: 'STERILIZATION', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Instrument tracking & dispatch', code: 'INSTRUMENT_TRACK', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'OT sterile supply support', code: 'OT_SUPPLY', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [TechnicianSubtype.OT]: {
    title: 'OT Technician — Technical Privileges',
    items: [
      { name: 'OT equipment setup & maintenance', code: 'OT_EQUIPMENT', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Surgical instrument handling', code: 'SURG_INSTRUMENTS', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Scrub/circulating assistance', code: 'SCRUB_CIRCULATE', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [TechnicianSubtype.CATHLAB]: {
    title: 'Cath Lab Technician — Technical Privileges',
    items: [
      { name: 'Cath lab equipment operation', code: 'CATH_EQUIPMENT', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Contrast & consumable management', code: 'CONSUMABLES', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Patient monitoring during procedure', code: 'PATIENT_MONITOR', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [TechnicianSubtype.NEURO]: {
    title: 'Neuro Technician — Technical Privileges',
    items: [
      { name: 'Neuro diagnostic equipment', code: 'NEURO_DIAG', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'EEG/EMG setup & recording', code: 'EEG_EMG', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Neuro OT assistance', code: 'NEURO_OT', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [TechnicianSubtype.CCU]: {
    title: 'CCU Technician — Technical Privileges',
    items: [
      { name: 'Cardiac monitor setup & troubleshooting', code: 'CARDIAC_MONITOR', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Defibrillator & crash cart readiness', code: 'CRASH_CART', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Bedside procedure assistance', code: 'BEDSIDE_ASSIST', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [TechnicianSubtype.ICU]: {
    title: 'ICU Technician — Technical Privileges',
    items: [
      { name: 'Ventilator & life support equipment', code: 'VENTILATOR', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'ICU monitoring systems', code: 'ICU_MONITOR', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Bedside invasive procedure assist', code: 'INVASIVE_ASSIST', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [TechnicianSubtype.SICU]: {
    title: 'SICU Technician — Technical Privileges',
    items: [
      { name: 'Post-surgical monitoring equipment', code: 'POST_SURG_MONITOR', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Surgical ICU device maintenance', code: 'SICU_DEVICES', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Drain & wound care equipment support', code: 'WOUND_SUPPORT', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [TechnicianSubtype.HDU]: {
    title: 'HDU Technician — Technical Privileges',
    items: [
      { name: 'HDU monitoring & equipment', code: 'HDU_MONITOR', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Step-down care device support', code: 'STEP_DOWN', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Advanced airway equipment assist', code: 'AIRWAY_ASSIST', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [TechnicianSubtype.PERFUSIONIST]: {
    title: 'Perfusionist — Clinical Privileges',
    items: [
      { name: 'Cardiopulmonary bypass setup & operation', code: 'CPB_OPERATION', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'ECMO / mechanical circulatory support', code: 'ECMO_MCS', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Blood conservation & autotransfusion', code: 'BLOOD_CONSERVATION', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Independent paediatric CPB', code: 'PEDIATRIC_CPB', defaultLevel: PrivilegeGrantLevel.NONE },
    ],
  },
  [AlliedHealthSubtype.PHYSIOTHERAPIST]: {
    title: 'Physiotherapist — Clinical Privileges',
    items: [
      { name: 'Outpatient physiotherapy assessment', code: 'PT_OPD', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Inpatient mobility & rehab', code: 'PT_IPD', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'ICU early mobilization', code: 'PT_ICU', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [AlliedHealthSubtype.PHARMACIST]: {
    title: 'Pharmacist — Clinical Privileges',
    items: [
      { name: 'Dispensing & medication review', code: 'PHARM_DISPENSE', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Clinical pharmacy ward rounds', code: 'PHARM_WARD', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Chemotherapy preparation', code: 'PHARM_CHEMO', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [AlliedHealthSubtype.RADIOGRAPHER]: {
    title: 'Radiographer — Clinical Privileges',
    items: [
      { name: 'General radiography', code: 'RAD_GENERAL', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'CT / MRI operation', code: 'RAD_CROSS', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Interventional radiology assist', code: 'RAD_IR', defaultLevel: PrivilegeGrantLevel.NONE },
    ],
  },
  [AlliedHealthSubtype.DIETICIAN]: {
    title: 'Dietician — Clinical Privileges',
    items: [
      { name: 'Nutrition assessment & care plans', code: 'DIET_ASSESS', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Therapeutic diet prescription', code: 'DIET_THERAPEUTIC', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Enteral/parenteral nutrition orders', code: 'DIET_TPN', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
  [AlliedHealthSubtype.RESPIRATORY_THERAPIST]: {
    title: 'Respiratory Therapist — Clinical Privileges',
    items: [
      { name: 'Nebulization & airway management', code: 'RT_AIRWAY', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Ventilator management assist', code: 'RT_VENT', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
      { name: 'Independent bronchoscopy assist', code: 'RT_BRONCH', defaultLevel: PrivilegeGrantLevel.NONE },
    ],
  },
  [AlliedHealthSubtype.SPEECH_THERAPIST]: {
    title: 'Speech Therapist — Clinical Privileges',
    items: [
      { name: 'Speech & language assessment', code: 'ST_ASSESS', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Swallowing (dysphagia) evaluation', code: 'ST_DYSPHAGIA', defaultLevel: PrivilegeGrantLevel.FULL },
      { name: 'Videofluoroscopy studies', code: 'ST_VFS', defaultLevel: PrivilegeGrantLevel.UNDER_SUPERVISION },
    ],
  },
};

export async function seedStaffCatalog(prisma: PrismaTx) {
  const categoryIds: Record<string, string> = {};
  const subtypeIds: Record<string, string> = {};

  for (const [idx, cat] of [
    { code: StaffCategory.DOCTOR, name: 'Doctors', description: 'Consultants, Associate Consultants, RMOs', requiresCommitteeReview: true },
    { code: StaffCategory.NURSE, name: 'Nurses', description: 'Senior and Fresher nurses', requiresCommitteeReview: true },
    { code: StaffCategory.TECHNICIAN, name: 'Technicians', description: 'CSSD, OT, Cath Lab, Neuro, CCU, ICU, SICU, HDU, Perfusionist', requiresCommitteeReview: true },
    { code: StaffCategory.ALLIED_HEALTH, name: 'Allied Health', description: 'Physiotherapist, Pharmacist, Radiographer, Dietician, Respiratory & Speech therapists', requiresCommitteeReview: true },
    { code: StaffCategory.ADMINISTRATIVE, name: 'Administrative', description: 'Admin officers, front desk, medical records', requiresCommitteeReview: false },
    { code: StaffCategory.HR, name: 'Human Resources', description: 'HR executives, managers, recruiters', requiresCommitteeReview: false },
    { code: StaffCategory.FINANCE, name: 'Finance & Accounts', description: 'Accountants, billing, cashiers', requiresCommitteeReview: false },
    { code: StaffCategory.IT, name: 'Information Technology', description: 'IT support, system admins, network engineers', requiresCommitteeReview: false },
    { code: StaffCategory.ENGINEERING, name: 'Engineering & Maintenance', description: 'Biomedical, maintenance, electrical', requiresCommitteeReview: false },
    { code: StaffCategory.HOUSEKEEPING, name: 'Housekeeping & Sanitation', description: 'Housekeeping staff, supervisors, ward attendants', requiresCommitteeReview: false },
    { code: StaffCategory.SECURITY, name: 'Security', description: 'Security guards and supervisors', requiresCommitteeReview: false },
    { code: StaffCategory.FOOD_SERVICES, name: 'Food & Nutrition Services', description: 'Kitchen, diet assistants, supervisors', requiresCommitteeReview: false },
    { code: StaffCategory.STORES, name: 'Stores & Purchase', description: 'Store keepers, purchase officers, inventory', requiresCommitteeReview: false },
  ].entries()) {
    const row = await prisma.staffCategory.upsert({
      where: { code: cat.code },
      update: {
        name: cat.name,
        description: cat.description,
        sortOrder: idx + 1,
        requiresCommitteeReview: cat.requiresCommitteeReview,
      },
      create: {
        code: cat.code,
        name: cat.name,
        description: cat.description,
        sortOrder: idx + 1,
        requiresCommitteeReview: cat.requiresCommitteeReview,
      },
    });
    categoryIds[cat.code] = row.id;
  }

  for (const [idx, sub] of STAFF_SUBTYPES.entries()) {
    const row = await prisma.staffSubtype.upsert({
      where: { code: sub.code },
      update: {
        name: sub.name,
        parentGroup: sub.parentGroup,
        categoryId: categoryIds[sub.category],
        sortOrder: idx + 1,
      },
      create: {
        code: sub.code,
        name: sub.name,
        parentGroup: sub.parentGroup,
        categoryId: categoryIds[sub.category],
        sortOrder: idx + 1,
      },
    });
    subtypeIds[sub.code] = row.id;
  }

  for (const [code, template] of Object.entries(JOB_DESCRIPTION_TEMPLATES)) {
    const subtypeId = subtypeIds[code];
    const sub = STAFF_SUBTYPES.find((s) => s.code === code);
    if (!subtypeId || !sub) continue;

    const jd = await prisma.jobDescription.upsert({
      where: { subtypeId_clinicalUnit: { subtypeId, clinicalUnit: '' } },
      update: { title: template.title },
      create: {
        categoryId: categoryIds[sub.category],
        subtypeId,
        clinicalUnit: '',
        title: template.title,
        description: `Standard privilege matrix for ${sub.name}`,
      },
    });

    await prisma.jobDescriptionItem.deleteMany({ where: { jobDescriptionId: jd.id } });
    await prisma.jobDescriptionItem.createMany({
      data: template.items.map((item, i) => ({
        jobDescriptionId: jd.id,
        name: item.name,
        code: item.code,
        defaultLevel: item.defaultLevel,
        sortOrder: i + 1,
      })),
    });
  }

  // OT technicians: separate job descriptions per clinical unit (Surgery OT vs CTVS OT)
  const otSubtypeId = subtypeIds[TechnicianSubtype.OT];
  const otTemplate = JOB_DESCRIPTION_TEMPLATES[TechnicianSubtype.OT];
  if (otSubtypeId && otTemplate) {
    for (const unit of ['Surgery OT', 'CTVS OT']) {
      const jd = await prisma.jobDescription.upsert({
        where: { subtypeId_clinicalUnit: { subtypeId: otSubtypeId, clinicalUnit: unit } },
        update: { title: `${otTemplate.title} — ${unit}` },
        create: {
          categoryId: categoryIds[StaffCategory.TECHNICIAN],
          subtypeId: otSubtypeId,
          clinicalUnit: unit,
          title: `${otTemplate.title} — ${unit}`,
          description: `OT technician privileges for ${unit}`,
        },
      });
      await prisma.jobDescriptionItem.deleteMany({ where: { jobDescriptionId: jd.id } });
      await prisma.jobDescriptionItem.createMany({
        data: otTemplate.items.map((item, i) => ({
          jobDescriptionId: jd.id,
          name: item.name,
          code: item.code,
          defaultLevel: item.defaultLevel,
          sortOrder: i + 1,
        })),
      });
    }
  }

  // Perfusionist: unit-specific job descriptions (CTVS OT)
  const perfusionistId = subtypeIds[TechnicianSubtype.PERFUSIONIST];
  const perfTemplate = JOB_DESCRIPTION_TEMPLATES[TechnicianSubtype.PERFUSIONIST];
  if (perfusionistId && perfTemplate) {
    for (const unit of ['CTVS OT', 'Cardiac OR']) {
      const jd = await prisma.jobDescription.upsert({
        where: { subtypeId_clinicalUnit: { subtypeId: perfusionistId, clinicalUnit: unit } },
        update: { title: `${perfTemplate.title} — ${unit}` },
        create: {
          categoryId: categoryIds[StaffCategory.TECHNICIAN],
          subtypeId: perfusionistId,
          clinicalUnit: unit,
          title: `${perfTemplate.title} — ${unit}`,
          description: `Perfusionist privileges for ${unit}`,
        },
      });
      await prisma.jobDescriptionItem.deleteMany({ where: { jobDescriptionId: jd.id } });
      await prisma.jobDescriptionItem.createMany({
        data: perfTemplate.items.map((item, i) => ({
          jobDescriptionId: jd.id,
          name: item.name,
          code: item.code,
          defaultLevel: item.defaultLevel,
          sortOrder: i + 1,
        })),
      });
    }
  }

  // Required documents per category
  const docSets: { category: StaffCategory; extra: typeof DOCTOR_EXTRA_DOCS }[] = [
    { category: StaffCategory.DOCTOR, extra: DOCTOR_EXTRA_DOCS },
    { category: StaffCategory.NURSE, extra: NURSE_EXTRA_DOCS },
    { category: StaffCategory.TECHNICIAN, extra: TECHNICIAN_EXTRA_DOCS },
    { category: StaffCategory.ALLIED_HEALTH, extra: ALLIED_HEALTH_EXTRA_DOCS },
  ];

  for (const { category, extra } of docSets) {
    const catId = categoryIds[category];
    await prisma.requiredDocument.deleteMany({ where: { staffCategoryId: catId, staffSubtypeId: null } });
    const allDocs = [...BASE_EDUCATION_DOCS, ...extra];
    await prisma.requiredDocument.createMany({
      data: allDocs.map((d) => ({
        name: d.name,
        type: d.type,
        staffCategoryId: catId,
        sortOrder: d.sortOrder,
        isRequired: false,
      })),
    });
  }

  // Non-clinical categories share a lighter document checklist
  for (const code of Object.values(StaffCategory)) {
    if (categoryRequiresCommittee(code)) continue;
    const catId = categoryIds[code];
    if (!catId) continue;
    await prisma.requiredDocument.deleteMany({ where: { staffCategoryId: catId, staffSubtypeId: null } });
    await prisma.requiredDocument.createMany({
      data: NON_CLINICAL_DOCS.map((d) => ({
        name: d.name,
        type: d.type,
        staffCategoryId: catId,
        sortOrder: d.sortOrder,
        isRequired: false,
      })),
    });
  }

  return { categoryIds, subtypeIds };
}

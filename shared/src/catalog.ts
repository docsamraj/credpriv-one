// Hospital staff taxonomy & workflow catalog — CredPriv One

export enum StaffCategory {
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  TECHNICIAN = 'TECHNICIAN',
}

export enum DoctorSubtype {
  FULL_TIME_CONSULTANT = 'FULL_TIME_CONSULTANT',
  VISITING_CONSULTANT = 'VISITING_CONSULTANT',
  ASSOCIATE_CONSULTANT = 'ASSOCIATE_CONSULTANT',
  RMO = 'RMO',
}

export enum NurseSubtype {
  SENIOR_NURSE = 'SENIOR_NURSE',
  FRESHER_NURSE = 'FRESHER_NURSE',
}

export enum TechnicianSubtype {
  CSSD = 'CSSD',
  OT = 'OT',
  CATHLAB = 'CATHLAB',
  NEURO = 'NEURO',
  CCU = 'CCU',
  ICU = 'ICU',
  SICU = 'SICU',
  HDU = 'HDU',
}

export type StaffSubtypeCode = DoctorSubtype | NurseSubtype | TechnicianSubtype;

export enum EducationDocumentType {
  TENTH_CERTIFICATE = 'TENTH_CERTIFICATE',
  TWELFTH_CERTIFICATE = 'TWELFTH_CERTIFICATE',
  UNDERGRADUATE = 'UNDERGRADUATE',
  POSTGRADUATE = 'POSTGRADUATE',
  SUPERSPECIALITY = 'SUPERSPECIALITY',
  MEDICAL_LICENSE = 'MEDICAL_LICENSE',
  GOVERNMENT_ID = 'GOVERNMENT_ID',
  NURSING_LICENSE = 'NURSING_LICENSE',
  TECHNICAL_CERTIFICATE = 'TECHNICAL_CERTIFICATE',
  EXPERIENCE_CERTIFICATE = 'EXPERIENCE_CERTIFICATE',
  OTHER = 'OTHER',
}

export enum PrivilegeGrantLevel {
  FULL = 'FULL',
  UNDER_SUPERVISION = 'UNDER_SUPERVISION',
  NONE = 'NONE',
}

export enum WorkflowPhase {
  APPOINTMENT = 'APPOINTMENT',
  DOCUMENT_UPLOAD = 'DOCUMENT_UPLOAD',
  CREDENTIALING = 'CREDENTIALING',
  PRIVILEGE_REQUEST = 'PRIVILEGE_REQUEST',
  COMMITTEE_REVIEW = 'COMMITTEE_REVIEW',
  COMPLETE = 'COMPLETE',
}

export interface StaffSubtypeInfo {
  code: StaffSubtypeCode;
  name: string;
  category: StaffCategory;
  parentGroup?: string;
}

export const STAFF_SUBTYPES: StaffSubtypeInfo[] = [
  { code: DoctorSubtype.FULL_TIME_CONSULTANT, name: 'Full Time Consultant', category: StaffCategory.DOCTOR, parentGroup: 'Consultant' },
  { code: DoctorSubtype.VISITING_CONSULTANT, name: 'Visiting Consultant', category: StaffCategory.DOCTOR, parentGroup: 'Consultant' },
  { code: DoctorSubtype.ASSOCIATE_CONSULTANT, name: 'Associate Consultant', category: StaffCategory.DOCTOR },
  { code: DoctorSubtype.RMO, name: 'RMO', category: StaffCategory.DOCTOR },
  { code: NurseSubtype.SENIOR_NURSE, name: 'Senior Nurse', category: StaffCategory.NURSE },
  { code: NurseSubtype.FRESHER_NURSE, name: 'Fresher Nurse', category: StaffCategory.NURSE },
  { code: TechnicianSubtype.CSSD, name: 'CSSD', category: StaffCategory.TECHNICIAN },
  { code: TechnicianSubtype.OT, name: 'OT', category: StaffCategory.TECHNICIAN },
  { code: TechnicianSubtype.CATHLAB, name: 'Cath Lab', category: StaffCategory.TECHNICIAN },
  { code: TechnicianSubtype.NEURO, name: 'Neuro', category: StaffCategory.TECHNICIAN },
  { code: TechnicianSubtype.CCU, name: 'CCU', category: StaffCategory.TECHNICIAN },
  { code: TechnicianSubtype.ICU, name: 'ICU', category: StaffCategory.TECHNICIAN },
  { code: TechnicianSubtype.SICU, name: 'SICU', category: StaffCategory.TECHNICIAN },
  { code: TechnicianSubtype.HDU, name: 'HDU', category: StaffCategory.TECHNICIAN },
];

export const CATEGORY_LABELS: Record<StaffCategory, string> = {
  [StaffCategory.DOCTOR]: 'Doctors',
  [StaffCategory.NURSE]: 'Nurses',
  [StaffCategory.TECHNICIAN]: 'Technicians',
};

export const PRIVILEGE_LEVEL_LABELS: Record<PrivilegeGrantLevel, string> = {
  [PrivilegeGrantLevel.FULL]: 'Full',
  [PrivilegeGrantLevel.UNDER_SUPERVISION]: 'Under Supervision',
  [PrivilegeGrantLevel.NONE]: 'None',
};

export const WORKFLOW_PHASE_LABELS: Record<WorkflowPhase, string> = {
  [WorkflowPhase.APPOINTMENT]: 'Appointment',
  [WorkflowPhase.DOCUMENT_UPLOAD]: 'Document Upload',
  [WorkflowPhase.CREDENTIALING]: 'Credentialing',
  [WorkflowPhase.PRIVILEGE_REQUEST]: 'Privilege Request',
  [WorkflowPhase.COMMITTEE_REVIEW]: 'Committee Review',
  [WorkflowPhase.COMPLETE]: 'Complete',
};

/** Base education docs required for all categories */
export const BASE_EDUCATION_DOCS = [
  { type: EducationDocumentType.TENTH_CERTIFICATE, name: '10th Certificate', sortOrder: 1 },
  { type: EducationDocumentType.TWELFTH_CERTIFICATE, name: '12th Certificate', sortOrder: 2 },
  { type: EducationDocumentType.GOVERNMENT_ID, name: 'Government ID (Aadhaar/PAN/Passport)', sortOrder: 99 },
];

export const DOCTOR_EXTRA_DOCS = [
  { type: EducationDocumentType.UNDERGRADUATE, name: 'Undergraduate (MBBS)', sortOrder: 3 },
  { type: EducationDocumentType.POSTGRADUATE, name: 'Postgraduate (MD/MS/DNB)', sortOrder: 4 },
  { type: EducationDocumentType.SUPERSPECIALITY, name: 'Superspeciality (DM/MCh)', sortOrder: 5 },
  { type: EducationDocumentType.MEDICAL_LICENSE, name: 'Updated Medical License', sortOrder: 6 },
  { type: EducationDocumentType.EXPERIENCE_CERTIFICATE, name: 'Experience Certificate', sortOrder: 7 },
];

export const NURSE_EXTRA_DOCS = [
  { type: EducationDocumentType.UNDERGRADUATE, name: 'Nursing Degree/Diploma (GNM/BSc)', sortOrder: 3 },
  { type: EducationDocumentType.NURSING_LICENSE, name: 'Nursing Council Registration', sortOrder: 4 },
  { type: EducationDocumentType.EXPERIENCE_CERTIFICATE, name: 'Experience Certificate', sortOrder: 5 },
];

export const TECHNICIAN_EXTRA_DOCS = [
  { type: EducationDocumentType.UNDERGRADUATE, name: 'Diploma/Degree Certificate', sortOrder: 3 },
  { type: EducationDocumentType.TECHNICAL_CERTIFICATE, name: 'Technical Certification', sortOrder: 4 },
  { type: EducationDocumentType.EXPERIENCE_CERTIFICATE, name: 'Experience Certificate', sortOrder: 5 },
];

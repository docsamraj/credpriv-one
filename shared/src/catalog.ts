// Hospital staff taxonomy & workflow catalog — CredPriv One

export enum StaffCategory {
  DOCTOR = 'DOCTOR',
  NURSE = 'NURSE',
  TECHNICIAN = 'TECHNICIAN',
  ADMINISTRATIVE = 'ADMINISTRATIVE',
  HR = 'HR',
  FINANCE = 'FINANCE',
  IT = 'IT',
  ENGINEERING = 'ENGINEERING',
  HOUSEKEEPING = 'HOUSEKEEPING',
  SECURITY = 'SECURITY',
  FOOD_SERVICES = 'FOOD_SERVICES',
  STORES = 'STORES',
  ALLIED_HEALTH = 'ALLIED_HEALTH',
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
  PERFUSIONIST = 'PERFUSIONIST',
}

export enum AdministrativeSubtype {
  ADMIN_OFFICER = 'ADMIN_OFFICER',
  FRONT_DESK = 'FRONT_DESK',
  EXECUTIVE_ASSISTANT = 'EXECUTIVE_ASSISTANT',
  MEDICAL_RECORDS_OFFICER = 'MEDICAL_RECORDS_OFFICER',
}

export enum HrSubtype {
  HR_EXECUTIVE = 'HR_EXECUTIVE',
  HR_MANAGER = 'HR_MANAGER',
  RECRUITER = 'RECRUITER',
}

export enum FinanceSubtype {
  ACCOUNTANT = 'ACCOUNTANT',
  BILLING_EXECUTIVE = 'BILLING_EXECUTIVE',
  CASHIER = 'CASHIER',
}

export enum ItSubtype {
  IT_SUPPORT = 'IT_SUPPORT',
  SYSTEM_ADMINISTRATOR = 'SYSTEM_ADMINISTRATOR',
  NETWORK_ENGINEER = 'NETWORK_ENGINEER',
}

export enum EngineeringSubtype {
  BIOMEDICAL_ENGINEER = 'BIOMEDICAL_ENGINEER',
  MAINTENANCE_TECHNICIAN = 'MAINTENANCE_TECHNICIAN',
  ELECTRICIAN = 'ELECTRICIAN',
}

export enum HousekeepingSubtype {
  HOUSEKEEPING_STAFF = 'HOUSEKEEPING_STAFF',
  HOUSEKEEPING_SUPERVISOR = 'HOUSEKEEPING_SUPERVISOR',
  WARD_ATTENDANT = 'WARD_ATTENDANT',
}

export enum SecuritySubtype {
  SECURITY_GUARD = 'SECURITY_GUARD',
  SECURITY_SUPERVISOR = 'SECURITY_SUPERVISOR',
}

export enum FoodServicesSubtype {
  KITCHEN_STAFF = 'KITCHEN_STAFF',
  DIET_ASSISTANT = 'DIET_ASSISTANT',
  FOOD_SERVICE_SUPERVISOR = 'FOOD_SERVICE_SUPERVISOR',
}

export enum StoresSubtype {
  STORE_KEEPER = 'STORE_KEEPER',
  PURCHASE_OFFICER = 'PURCHASE_OFFICER',
  INVENTORY_CLERK = 'INVENTORY_CLERK',
}

export enum AlliedHealthSubtype {
  PHYSIOTHERAPIST = 'PHYSIOTHERAPIST',
  PHARMACIST = 'PHARMACIST',
  RADIOGRAPHER = 'RADIOGRAPHER',
  DIETICIAN = 'DIETICIAN',
  RESPIRATORY_THERAPIST = 'RESPIRATORY_THERAPIST',
  SPEECH_THERAPIST = 'SPEECH_THERAPIST',
}

export type StaffSubtypeCode =
  | DoctorSubtype
  | NurseSubtype
  | TechnicianSubtype
  | AlliedHealthSubtype
  | AdministrativeSubtype
  | HrSubtype
  | FinanceSubtype
  | ItSubtype
  | EngineeringSubtype
  | HousekeepingSubtype
  | SecuritySubtype
  | FoodServicesSubtype
  | StoresSubtype;

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
  POLICE_VERIFICATION = 'POLICE_VERIFICATION',
  APPOINTMENT_LETTER = 'APPOINTMENT_LETTER',
  PROFESSIONAL_TRAINING = 'PROFESSIONAL_TRAINING',
  OTHER = 'OTHER',
}

/** Document types that allow multiple file uploads (e.g. several experience letters) */
export const MULTI_UPLOAD_DOCUMENT_TYPES: EducationDocumentType[] = [
  EducationDocumentType.EXPERIENCE_CERTIFICATE,
  EducationDocumentType.PROFESSIONAL_TRAINING,
  EducationDocumentType.TECHNICAL_CERTIFICATE,
  EducationDocumentType.OTHER,
];

export function allowsMultipleDocumentUploads(type: string): boolean {
  return MULTI_UPLOAD_DOCUMENT_TYPES.includes(type as EducationDocumentType);
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
  DEPARTMENT_APPROVAL = 'DEPARTMENT_APPROVAL',
  STAFF_CLEARANCE = 'STAFF_CLEARANCE',
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
  { code: TechnicianSubtype.PERFUSIONIST, name: 'Perfusionist', category: StaffCategory.TECHNICIAN },
  { code: AdministrativeSubtype.ADMIN_OFFICER, name: 'Administrative Officer', category: StaffCategory.ADMINISTRATIVE },
  { code: AdministrativeSubtype.FRONT_DESK, name: 'Front Desk / Reception', category: StaffCategory.ADMINISTRATIVE },
  { code: AdministrativeSubtype.EXECUTIVE_ASSISTANT, name: 'Executive Assistant', category: StaffCategory.ADMINISTRATIVE },
  { code: AdministrativeSubtype.MEDICAL_RECORDS_OFFICER, name: 'Medical Records Officer', category: StaffCategory.ADMINISTRATIVE },
  { code: HrSubtype.HR_EXECUTIVE, name: 'HR Executive', category: StaffCategory.HR },
  { code: HrSubtype.HR_MANAGER, name: 'HR Manager', category: StaffCategory.HR },
  { code: HrSubtype.RECRUITER, name: 'Recruiter', category: StaffCategory.HR },
  { code: FinanceSubtype.ACCOUNTANT, name: 'Accountant', category: StaffCategory.FINANCE },
  { code: FinanceSubtype.BILLING_EXECUTIVE, name: 'Billing Executive', category: StaffCategory.FINANCE },
  { code: FinanceSubtype.CASHIER, name: 'Cashier', category: StaffCategory.FINANCE },
  { code: ItSubtype.IT_SUPPORT, name: 'IT Support', category: StaffCategory.IT },
  { code: ItSubtype.SYSTEM_ADMINISTRATOR, name: 'System Administrator', category: StaffCategory.IT },
  { code: ItSubtype.NETWORK_ENGINEER, name: 'Network Engineer', category: StaffCategory.IT },
  { code: EngineeringSubtype.BIOMEDICAL_ENGINEER, name: 'Biomedical Engineer', category: StaffCategory.ENGINEERING },
  { code: EngineeringSubtype.MAINTENANCE_TECHNICIAN, name: 'Maintenance Technician', category: StaffCategory.ENGINEERING },
  { code: EngineeringSubtype.ELECTRICIAN, name: 'Electrician / Plumber', category: StaffCategory.ENGINEERING },
  { code: HousekeepingSubtype.HOUSEKEEPING_STAFF, name: 'Housekeeping Staff', category: StaffCategory.HOUSEKEEPING },
  { code: HousekeepingSubtype.HOUSEKEEPING_SUPERVISOR, name: 'Housekeeping Supervisor', category: StaffCategory.HOUSEKEEPING },
  { code: HousekeepingSubtype.WARD_ATTENDANT, name: 'Ward Attendant / Ward Boy', category: StaffCategory.HOUSEKEEPING },
  { code: SecuritySubtype.SECURITY_GUARD, name: 'Security Guard', category: StaffCategory.SECURITY },
  { code: SecuritySubtype.SECURITY_SUPERVISOR, name: 'Security Supervisor', category: StaffCategory.SECURITY },
  { code: FoodServicesSubtype.KITCHEN_STAFF, name: 'Kitchen Staff', category: StaffCategory.FOOD_SERVICES },
  { code: FoodServicesSubtype.DIET_ASSISTANT, name: 'Diet Assistant', category: StaffCategory.FOOD_SERVICES },
  { code: FoodServicesSubtype.FOOD_SERVICE_SUPERVISOR, name: 'Food Service Supervisor', category: StaffCategory.FOOD_SERVICES },
  { code: StoresSubtype.STORE_KEEPER, name: 'Store Keeper', category: StaffCategory.STORES },
  { code: StoresSubtype.PURCHASE_OFFICER, name: 'Purchase Officer', category: StaffCategory.STORES },
  { code: StoresSubtype.INVENTORY_CLERK, name: 'Inventory Clerk', category: StaffCategory.STORES },
  { code: AlliedHealthSubtype.PHYSIOTHERAPIST, name: 'Physiotherapist', category: StaffCategory.ALLIED_HEALTH },
  { code: AlliedHealthSubtype.PHARMACIST, name: 'Pharmacist', category: StaffCategory.ALLIED_HEALTH },
  { code: AlliedHealthSubtype.RADIOGRAPHER, name: 'Radiographer', category: StaffCategory.ALLIED_HEALTH },
  { code: AlliedHealthSubtype.DIETICIAN, name: 'Dietician', category: StaffCategory.ALLIED_HEALTH },
  { code: AlliedHealthSubtype.RESPIRATORY_THERAPIST, name: 'Respiratory Therapist', category: StaffCategory.ALLIED_HEALTH },
  { code: AlliedHealthSubtype.SPEECH_THERAPIST, name: 'Speech Therapist', category: StaffCategory.ALLIED_HEALTH },
];

/** Clinical roles that require privilege matrix + credentialing committee review */
export const CLINICAL_STAFF_CATEGORIES: StaffCategory[] = [
  StaffCategory.DOCTOR,
  StaffCategory.NURSE,
  StaffCategory.TECHNICIAN,
  StaffCategory.ALLIED_HEALTH,
];

export function categoryRequiresCommittee(code: StaffCategory): boolean {
  return CLINICAL_STAFF_CATEGORIES.includes(code);
}

export const CATEGORY_LABELS: Record<StaffCategory, string> = {
  [StaffCategory.DOCTOR]: 'Doctors',
  [StaffCategory.NURSE]: 'Nurses',
  [StaffCategory.TECHNICIAN]: 'Technicians',
  [StaffCategory.ADMINISTRATIVE]: 'Administrative',
  [StaffCategory.HR]: 'Human Resources',
  [StaffCategory.FINANCE]: 'Finance & Accounts',
  [StaffCategory.IT]: 'Information Technology',
  [StaffCategory.ENGINEERING]: 'Engineering & Maintenance',
  [StaffCategory.HOUSEKEEPING]: 'Housekeeping & Sanitation',
  [StaffCategory.SECURITY]: 'Security',
  [StaffCategory.FOOD_SERVICES]: 'Food & Nutrition Services',
  [StaffCategory.STORES]: 'Stores & Purchase',
  [StaffCategory.ALLIED_HEALTH]: 'Allied Health',
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
  [WorkflowPhase.DEPARTMENT_APPROVAL]: 'Department Approval',
  [WorkflowPhase.STAFF_CLEARANCE]: 'Staff Clearance',
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
  { type: EducationDocumentType.PROFESSIONAL_TRAINING, name: 'Professional Training / CME', sortOrder: 8 },
];

export const NURSE_EXTRA_DOCS = [
  { type: EducationDocumentType.UNDERGRADUATE, name: 'Nursing Degree/Diploma (GNM/BSc)', sortOrder: 3 },
  { type: EducationDocumentType.NURSING_LICENSE, name: 'Nursing Council Registration', sortOrder: 4 },
  { type: EducationDocumentType.EXPERIENCE_CERTIFICATE, name: 'Experience Certificate', sortOrder: 5 },
  { type: EducationDocumentType.PROFESSIONAL_TRAINING, name: 'Professional Training / CME', sortOrder: 6 },
];

export const TECHNICIAN_EXTRA_DOCS = [
  { type: EducationDocumentType.UNDERGRADUATE, name: 'Diploma/Degree Certificate', sortOrder: 3 },
  { type: EducationDocumentType.TECHNICAL_CERTIFICATE, name: 'Technical Certification', sortOrder: 4 },
  { type: EducationDocumentType.EXPERIENCE_CERTIFICATE, name: 'Experience Certificate', sortOrder: 5 },
  { type: EducationDocumentType.PROFESSIONAL_TRAINING, name: 'Professional Training', sortOrder: 6 },
];

export const ALLIED_HEALTH_EXTRA_DOCS = [
  { type: EducationDocumentType.UNDERGRADUATE, name: 'Professional Degree/Diploma', sortOrder: 3 },
  { type: EducationDocumentType.TECHNICAL_CERTIFICATE, name: 'Council / Board Registration', sortOrder: 4 },
  { type: EducationDocumentType.EXPERIENCE_CERTIFICATE, name: 'Experience Certificate', sortOrder: 5 },
  { type: EducationDocumentType.PROFESSIONAL_TRAINING, name: 'Professional Training / CME', sortOrder: 6 },
];

/** User-facing product labels (internal model remains Provider) */
export const PRODUCT_LABELS = {
  platformName: 'CredPriv One',
  platformTagline: 'Hospital Staff Credentialing Platform',
  applicantSingular: 'Applicant',
  applicantPlural: 'Applicants',
  staffMemberSingular: 'Staff Member',
  staffMemberPlural: 'Staff Members',
  myDashboard: 'My Dashboard',
};

/** Required documents for non-clinical hospital staff (no committee / privilege matrix) */
export const NON_CLINICAL_DOCS = [
  { type: EducationDocumentType.TENTH_CERTIFICATE, name: '10th Certificate', sortOrder: 1 },
  { type: EducationDocumentType.TWELFTH_CERTIFICATE, name: '12th Certificate', sortOrder: 2 },
  { type: EducationDocumentType.UNDERGRADUATE, name: 'Highest Qualification Certificate', sortOrder: 3 },
  { type: EducationDocumentType.GOVERNMENT_ID, name: 'Government ID (Aadhaar/PAN/Passport)', sortOrder: 4 },
  { type: EducationDocumentType.EXPERIENCE_CERTIFICATE, name: 'Experience Certificate', sortOrder: 5 },
  { type: EducationDocumentType.POLICE_VERIFICATION, name: 'Police Verification / Character Certificate', sortOrder: 6 },
  { type: EducationDocumentType.APPOINTMENT_LETTER, name: 'Previous Employment / Appointment Letter', sortOrder: 7 },
  { type: EducationDocumentType.PROFESSIONAL_TRAINING, name: 'Professional Training', sortOrder: 8 },
];

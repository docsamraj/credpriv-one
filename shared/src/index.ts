// CredPriv One — Shared types and enums
// Used by both backend and frontend

// ─── Enums ───────────────────────────────────────────────────────────────────

export enum UserRole {
  PROVIDER = 'PROVIDER',
  CREDENTIALING_STAFF = 'CREDENTIALING_STAFF',
  DEPARTMENT_CHAIR = 'DEPARTMENT_CHAIR',
  COMMITTEE_MEMBER = 'COMMITTEE_MEMBER',
  MEC_MEMBER = 'MEC_MEMBER',
  ADMINISTRATOR = 'ADMINISTRATOR',
  QUALITY_ACCREDITATION = 'QUALITY_ACCREDITATION',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

export enum ApplicationStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  UNDER_VERIFICATION = 'UNDER_VERIFICATION',
  COMMITTEE = 'COMMITTEE',
  MEC = 'MEC',
  BOARD = 'BOARD',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  NEEDS_INFO = 'NEEDS_INFO',
}

export enum ApplicationType {
  INITIAL_APPOINTMENT = 'INITIAL_APPOINTMENT',
  REAPPOINTMENT = 'REAPPOINTMENT',
  PRIVILEGE_REQUEST = 'PRIVILEGE_REQUEST',
  TEMPORARY_PRIVILEGE = 'TEMPORARY_PRIVILEGE',
}

export enum CredentialType {
  LICENSE = 'LICENSE',
  DEGREE = 'DEGREE',
  TRAINING = 'TRAINING',
  CERTIFICATION = 'CERTIFICATION',
  EMPLOYMENT = 'EMPLOYMENT',
  REFERENCE = 'REFERENCE',
  INSURANCE = 'INSURANCE',
  IDENTITY = 'IDENTITY',
  OTHER = 'OTHER',
}

export enum CredentialStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  EXPIRED = 'EXPIRED',
  REJECTED = 'REJECTED',
}

export enum VerificationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum PrivilegeStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  TEMPORARY = 'TEMPORARY',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

export enum CommitteeType {
  CREDENTIALING = 'CREDENTIALING',
  MEC = 'MEC',
  BOARD = 'BOARD',
  DEPARTMENT = 'DEPARTMENT',
}

export enum DecisionType {
  APPROVE = 'APPROVE',
  DENY = 'DENY',
  DEFER = 'DEFER',
  RETURN_FOR_INFO = 'RETURN_FOR_INFO',
  GRANT_TEMPORARY = 'GRANT_TEMPORARY',
}

export enum MonitoringEventType {
  OPPE = 'OPPE',
  FPPE = 'FPPE',
  PEER_REVIEW = 'PEER_REVIEW',
  INCIDENT = 'INCIDENT',
  PROCTORING = 'PROCTORING',
  FOCUSED_REVIEW = 'FOCUSED_REVIEW',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  IN_APP = 'IN_APP',
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  SUBMIT = 'SUBMIT',
  VERIFY = 'VERIFY',
  DECIDE = 'DECIDE',
  APPROVE = 'APPROVE',
  DENY = 'DENY',
  LOGIN = 'LOGIN',
  CONFIG_CHANGE = 'CONFIG_CHANGE',
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  roles: UserRole[];
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface ProviderSummary {
  id: string;
  firstName: string;
  lastName: string;
  specialty?: string;
  department?: string;
  applicationStatus?: ApplicationStatus;
  credentialsExpiringSoon?: number;
}

export interface AnalyticsOverview {
  pendingApplications: number;
  pendingVerifications: number;
  committeeReadyCases: number;
  expiringCredentials30: number;
  expiringCredentials60: number;
  expiringCredentials90: number;
  temporaryPrivileges: number;
  overdueReappointments: number;
  avgTurnaroundDays: number;
}

export interface TurnaroundMetrics {
  stage: string;
  avgDays: number;
  count: number;
}

export interface BottleneckAnalysis {
  stage: string;
  department?: string;
  pendingCount: number;
  avgWaitDays: number;
}

// ─── AI Module Types ───────────────────────────────────────────────────────────

export interface AiCaseSummary {
  providerId: string;
  summary: string;
  flags: AiFlag[];
  generatedAt: string;
}

export interface AiFlag {
  type: 'MISSING_DOC' | 'EXPIRED' | 'INCONSISTENT' | 'RISK' | 'INFO';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
  field?: string;
}

export interface OcrExtractionResult {
  documentId: string;
  extractedFields: Record<string, string>;
  confidence: number;
}

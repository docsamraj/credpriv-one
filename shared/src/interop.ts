// Interoperability types — extensible for HIS/EMR/HRIS/NABH connectors

export enum IntegrationSystemType {
  HIS = 'HIS',
  EMR = 'EMR',
  HRIS = 'HRIS',
  REGISTRY = 'REGISTRY',
  NABH = 'NABH',
  OTHER = 'OTHER',
}

export enum ExternalEntityType {
  PROVIDER = 'PROVIDER',
  APPLICATION = 'APPLICATION',
  CREDENTIAL = 'CREDENTIAL',
  PRIVILEGE = 'PRIVILEGE',
  USER = 'USER',
  COMMITTEE_DECISION = 'COMMITTEE_DECISION',
}

export enum DataExchangeFormat {
  FHIR_R4 = 'FHIR_R4',
  JSON = 'JSON',
  CSV = 'CSV',
  HL7_V2 = 'HL7_V2',
}

export enum DataExchangeDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

/** Reserved webhook events — add new events here as modules grow */
export enum IntegrationWebhookEvent {
  APPLICATION_SUBMITTED = 'APPLICATION_SUBMITTED',
  APPLICATION_APPROVED = 'APPLICATION_APPROVED',
  CREDENTIALING_COMPLETE = 'CREDENTIALING_COMPLETE',
  PRIVILEGE_GRANTED = 'PRIVILEGE_GRANTED',
  COMMITTEE_DECISION_RECORDED = 'COMMITTEE_DECISION_RECORDED',
  MEETING_MINUTES_SENT = 'MEETING_MINUTES_SENT',
  DEPARTMENT_APPROVAL_REQUESTED = 'DEPARTMENT_APPROVAL_REQUESTED',
  DEPARTMENT_APPROVAL_GRANTED = 'DEPARTMENT_APPROVAL_GRANTED',
}

export interface FhirBundleMeta {
  source: string;
  version: string;
  exportedAt: string;
}

export interface DocumentComplianceItem {
  type: string;
  name: string;
  isRequired: boolean;
  uploaded: boolean;
}

export interface DocumentComplianceReport {
  applicationId: string;
  complete: boolean;
  /** When false, uploads are advisory and do not block credentialing */
  gateEnforced?: boolean;
  requiredCount: number;
  uploadedCount: number;
  missing: DocumentComplianceItem[];
  items: DocumentComplianceItem[];
}

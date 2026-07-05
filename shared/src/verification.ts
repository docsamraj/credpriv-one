// Background verification & PSV tracking — extensible for hospital / third-party workflows

export enum VerifierType {
  HOSPITAL = 'HOSPITAL',
  THIRD_PARTY = 'THIRD_PARTY',
}

export enum BackgroundVerificationType {
  BACKGROUND_CHECK = 'BACKGROUND_CHECK',
  CRIMINAL_RECORD = 'CRIMINAL_RECORD',
  EMPLOYMENT_HISTORY = 'EMPLOYMENT_HISTORY',
  REFERENCE_CHECK = 'REFERENCE_CHECK',
  PSV = 'PSV',
  OTHER = 'OTHER',
}

export enum BackgroundVerificationStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  CLEAR = 'CLEAR',
  ADVERSE = 'ADVERSE',
  INCONCLUSIVE = 'INCONCLUSIVE',
}

export const VERIFIER_TYPE_LABELS: Record<VerifierType, string> = {
  [VerifierType.HOSPITAL]: 'Hospital (in-house)',
  [VerifierType.THIRD_PARTY]: 'Third-party agency',
};

export const BACKGROUND_VERIFICATION_TYPE_LABELS: Record<BackgroundVerificationType, string> = {
  [BackgroundVerificationType.BACKGROUND_CHECK]: 'Background check',
  [BackgroundVerificationType.CRIMINAL_RECORD]: 'Criminal record check',
  [BackgroundVerificationType.EMPLOYMENT_HISTORY]: 'Employment history',
  [BackgroundVerificationType.REFERENCE_CHECK]: 'Reference check',
  [BackgroundVerificationType.PSV]: 'Primary source verification',
  [BackgroundVerificationType.OTHER]: 'Other',
};

export const BACKGROUND_VERIFICATION_STATUS_LABELS: Record<BackgroundVerificationStatus, string> = {
  [BackgroundVerificationStatus.PENDING]: 'Pending',
  [BackgroundVerificationStatus.IN_PROGRESS]: 'In progress',
  [BackgroundVerificationStatus.CLEAR]: 'Clear',
  [BackgroundVerificationStatus.ADVERSE]: 'Adverse',
  [BackgroundVerificationStatus.INCONCLUSIVE]: 'Inconclusive',
};

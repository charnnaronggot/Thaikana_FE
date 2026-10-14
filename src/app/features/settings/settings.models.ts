export interface CompanySettingsSnapshot {
  revisionId: string; revision: number; legalName: string; address: string; taxId: string | null;
  logoFileId: string | null; vatRate: number; currency: string; paymentTerms: string;
  bankName: string | null; bankAccountName: string | null; bankAccountNumber: string | null;
  effectiveAt: string; updatedByUserId: string;
}
export interface CompanySettings { isConfigured: boolean; version: string; current: CompanySettingsSnapshot | null; }
export interface CompanyDefaults { isConfigured: boolean; settingsRevisionId: string | null; vatRate: number | null; currency: string | null; paymentTerms: string | null; }
export interface SaveCompanySettings {
  expectedVersion: string; legalName: string; address: string; taxId: string | null; logoFileId: string | null;
  vatRate: number; currency: string; paymentTerms: string; bankName: string | null;
  bankAccountName: string | null; bankAccountNumber: string | null; reason: string;
}

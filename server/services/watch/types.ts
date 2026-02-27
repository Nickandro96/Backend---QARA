export type Jurisdiction = "EU" | "UK" | "CH" | "US";

export type RegulatoryUpdateType =
  | "REGULATION"
  | "GUIDANCE"
  | "STANDARD"
  | "QUALITY";

export type RegulatoryUpdateStatus =
  | "NEW"
  | "UPDATED"
  | "REPEALED"
  | "CORRIGENDUM";

export type ImpactLevel = "Low" | "Medium" | "High" | "Critical";

export type ImpactedDomain =
  | "PMS"
  | "PMCF"
  | "ClinicalEvaluation"
  | "Vigilance"
  | "UDI"
  | "Labeling"
  | "RiskManagement"
  | "QMS"
  | "Supplier"
  | "Software"
  | "Usability"
  | "Biocompatibility"
  | "Sterilization"
  | "PerformanceSafety"
  | "PostMarket"
  | "Other";

export type EconomicRole =
  | "fabricant"
  | "importateur"
  | "distributeur"
  | "sous_traitant"
  | "ar";

export type CompanyClass = "I" | "IIa" | "IIb" | "III";

export type DeviceFamily =
  | "active"
  | "non_active"
  | "implantable"
  | "sterile"
  | "software"
  | "in_vitro";

export type UpdateTag = {
  key: string;
  value?: string;
};

export type MdrImpact = {
  articles: string[];
  annexes: string[];
};

export type ActionItem = {
  id: string;
  title: string;
  owner: "RA" | "QA" | "Clinical" | "PMS" | "Vigilance" | "Engineering" | "Supply" | "RegAff" | "Other";
  dueDays: 7 | 14 | 30 | 60 | 90;
  deliverables: string[];
  expectedEvidence: string[];
};

export type RegulatoryUpdate = {
  id: string; // uuid
  type: RegulatoryUpdateType;
  title: string;
  summaryShort: string;
  summaryLong: string;

  publishedAt: Date;
  effectiveAt: Date | null;

  status: RegulatoryUpdateStatus;

  sourceName: string;
  sourceUrl: string;
  sourceId: string | null;

  jurisdiction: Jurisdiction;

  tags: UpdateTag[];
  impactedMdr: MdrImpact;
  impactedDomains: ImpactedDomain[];
  impactedRoles: EconomicRole[];
  impactLevel: ImpactLevel;

  risks: string[];
  recommendedActions: ActionItem[];
  expectedEvidence: string[];

  hash: string;
  retrievedAt: Date;
};

export type UpdateSourceHealth = {
  name: string;
  ok: boolean;
  message?: string;
  durationMs?: number;
  items?: number;
};

export type UpdateSource = {
  name: string;
  fetchUpdates: (ctx: { timeoutMs: number }) => Promise<{
    items: Omit<RegulatoryUpdate, "id" | "summaryShort" | "summaryLong" | "impactedMdr" | "impactedDomains" | "impactedRoles" | "impactLevel" | "risks" | "recommendedActions" | "expectedEvidence">[];
    health: UpdateSourceHealth;
  }>;
};

export type EnrichmentResult = Pick<
  RegulatoryUpdate,
  | "summaryShort"
  | "summaryLong"
  | "impactedMdr"
  | "impactedDomains"
  | "impactedRoles"
  | "impactLevel"
  | "risks"
  | "recommendedActions"
  | "expectedEvidence"
>;

export type CompanyProfile = {
  economicRole: EconomicRole;
  deviceClass: CompanyClass;
  deviceFamilies: DeviceFamily[];
  markets: Jurisdiction[];
};

export type PersonalizedImpact = {
  impactLevel: ImpactLevel;
  reasons: string[];
  plan30: ActionItem[];
  plan60: ActionItem[];
  plan90: ActionItem[];
  sopDocsToUpdate: string[];
  auditReadinessChecklist: string[];
};

export type WatchMeta = {
  lastRefresh: Date | null;
  stale: boolean;
  refreshInProgress: boolean;
  degraded: boolean;
  sourceHealth: UpdateSourceHealth[];
};

export type SectorTopic = "audit_trends" | "safety_alerts" | "regulatory_updates" | "best_practices";
export type RealDocument = { id: string; title: string; source: string; url: string; publishedAt: string | null; content: string; status?: string | null; applicationDate?: string | null };

export type RegulatorySourceDefinition = {
  id: string;
  name: string;
  urlBase: string;
  type: "rss" | "rest" | "odata" | "sparql" | "html" | "pdf";
  active: boolean;
  frequency: string;
  accessType: string;
  commercialUseAllowed: boolean | null;
  licenceNotes: string;
  authorityType: "official" | "secondary";
};

export function isTgaEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.WATCH_TGA_ENABLED === "true";
}

const TGA_ENABLED = isTgaEnabled();

export const REGULATORY_SOURCE_REGISTRY: RegulatorySourceDefinition[] = [
  { id: "eur-lex-mdr", name: "EUR-Lex CELLAR", urlBase: "https://publications.europa.eu/webapi/rdf/sparql", type: "sparql", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "EU public data; retain source attribution.", authorityType: "official" },
  { id: "mdcg", name: "European Commission MDCG", urlBase: "https://health.ec.europa.eu/medical-devices-sector/new-regulations/guidance-mdcg-endorsed-documents-and-other-guidance_en", type: "html", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: null, licenceNotes: "Commercial reuse must be verified against the page notice.", authorityType: "official" },
  { id: "harmonised-standards", name: "EU Harmonised Standards", urlBase: "https://single-market-economy.ec.europa.eu/single-market/european-standards/harmonised-standards/medical-devices_en", type: "html", active: true, frequency: "weekly", accessType: "public", commercialUseAllowed: null, licenceNotes: "Public list; normative standards remain protected.", authorityType: "official" },
  { id: "iso-open-data", name: "ISO Open Data", urlBase: "https://isopublicstorageprod.blob.core.windows.net/opendata/_latest/iso_deliverables_metadata/json/iso_deliverables_metadata.jsonl", type: "rest", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "Metadata only; ODC Attribution 1.0. Normative ISO content remains protected.", authorityType: "official" },
  { id: "federal-register", name: "US Federal Register", urlBase: "https://www.federalregister.gov/api/v1/documents.json", type: "rest", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "Official US government public data.", authorityType: "official" },
  { id: "ansm", name: "ANSM - Agence nationale de securite du medicament", urlBase: "https://ansm.sante.fr", type: "rss", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: null, licenceNotes: "Donnees publiques francaises - verifier Licence Ouverte Etalab avant usage commercial.", authorityType: "official" },
  { id: "fda-medwatch", name: "FDA MedWatch - Rappels dispositifs medicaux", urlBase: "https://api.fda.gov/device/enforcement.json", type: "rest", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "Domaine public US - reutilisation libre.", authorityType: "official" },
  { id: "health-canada", name: "Health Canada - Rappels et avis de securite DM", urlBase: "https://recalls-rappels.canada.ca", type: "rest", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "Open Government Licence Canada.", authorityType: "official" },
  { id: "tga", name: "TGA - Therapeutic Goods Administration (Australie)", urlBase: "https://www.tga.gov.au", type: "rss", active: TGA_ENABLED, frequency: "daily", accessType: TGA_ENABLED ? "authorized-relay" : "public-configured", commercialUseAllowed: null, licenceNotes: TGA_ENABLED ? "Collecte active via WATCH_TGA_FEED_BASE_URL ou WATCH_RELAY_BASE_URL." : "Source conservee mais inactive tant qu'un relais TGA autorise et fonctionnel n'est pas configure; le cache existant reste consultable.", authorityType: "official" },
  { id: "mhra", name: "MHRA - Medicines and Healthcare products Regulatory Agency (UK)", urlBase: "https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency", type: "rss", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "Open Government Licence UK.", authorityType: "official" },
  { id: "swissmedic", name: "Swissmedic", urlBase: "https://www.swissmedic.ch/swissmedic/en/home/news/rss.html", type: "rss", active: false, frequency: "daily", accessType: "public-configured", commercialUseAllowed: null, licenceNotes: "Activate with WATCH_SWISSMEDIC_RSS after confirming the exact official medical-device feed URL and reuse notice.", authorityType: "official" },
  { id: "pmda", name: "PMDA (supervised)", urlBase: "https://www.pmda.go.jp/english/safety/info-services/devices/0007.html", type: "html", active: false, frequency: "weekly", accessType: "supervised", commercialUseAllowed: null, licenceNotes: "No stable public machine API identified; enable only after written reuse/automation validation.", authorityType: "official" },
];

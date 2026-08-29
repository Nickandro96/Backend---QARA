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
};

export const REGULATORY_SOURCE_REGISTRY: RegulatorySourceDefinition[] = [
  { id: "eur-lex-mdr", name: "EUR-Lex CELLAR", urlBase: "https://publications.europa.eu/webapi/rdf/sparql", type: "sparql", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "EU public data; retain source attribution." },
  { id: "mdcg", name: "European Commission MDCG", urlBase: "https://health.ec.europa.eu/medical-devices-sector/new-regulations/guidance-mdcg-documents_en", type: "html", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: null, licenceNotes: "Commercial reuse must be verified against the page notice." },
  { id: "harmonised-standards", name: "EU Harmonised Standards", urlBase: "https://single-market-economy.ec.europa.eu/single-market/european-standards/harmonised-standards/medical-devices_en", type: "html", active: true, frequency: "weekly", accessType: "public", commercialUseAllowed: null, licenceNotes: "Public list; normative standards remain protected." },
  { id: "iso-news", name: "ISO public RSS", urlBase: "https://www.iso.org/contents/data/publication_feeds/iso_rss.xml", type: "rss", active: true, frequency: "weekly", accessType: "public", commercialUseAllowed: null, licenceNotes: "News metadata only; normative ISO content is protected." },
  { id: "federal-register", name: "US Federal Register", urlBase: "https://www.federalregister.gov/api/v1/documents.json", type: "rest", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "Official US government public data." },
];

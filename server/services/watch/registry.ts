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
  { id: "ansm", name: "ANSM - Agence nationale de securite du medicament", urlBase: "https://ansm.sante.fr", type: "rss", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: null, licenceNotes: "Donnees publiques francaises - verifier Licence Ouverte Etalab avant usage commercial." },
  { id: "fda-medwatch", name: "FDA MedWatch - Rappels dispositifs medicaux", urlBase: "https://api.fda.gov/device/enforcement.json", type: "rest", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "Domaine public US - reutilisation libre." },
  { id: "health-canada", name: "Health Canada - Rappels et avis de securite DM", urlBase: "https://recalls-rappels.canada.ca", type: "rest", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "Open Government Licence Canada." },
  { id: "tga", name: "TGA - Therapeutic Goods Administration (Australie)", urlBase: "https://www.tga.gov.au", type: "rss", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: null, licenceNotes: "Conditions du site TGA a verifier avant usage commercial." },
  { id: "mhra", name: "MHRA - Medicines and Healthcare products Regulatory Agency (UK)", urlBase: "https://www.gov.uk/government/organisations/medicines-and-healthcare-products-regulatory-agency", type: "rss", active: true, frequency: "daily", accessType: "public", commercialUseAllowed: true, licenceNotes: "Open Government Licence UK." },
];

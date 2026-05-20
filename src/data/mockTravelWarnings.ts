export type WarningCategory = "regulatory" | "health" | "environmental";
export type WarningSeverity = "info" | "advisory";

export interface TravelWarning {
  id: string;
  category: WarningCategory;
  severity: WarningSeverity;
  title: string;
  body: string;
  /** ISO-3166 alpha-2 country codes or region keywords (lowercase) */
  regions: string[];
  valid_from: string; // ISO date
  valid_to: string;   // ISO date
  source_label: string;
}

export const MOCK_TRAVEL_WARNINGS: TravelWarning[] = [
  {
    id: "w-ees-2026",
    category: "regulatory",
    severity: "info",
    title: "EU Entry/Exit System (EES) is now active",
    body: "Non-EU travellers entering the Schengen Area must register biometric data (facial image and fingerprints) at the first port of entry. Expect longer queues at major airports for the first crossing of the trip.",
    regions: ["it", "fr", "es", "de", "nl", "be", "pt", "at", "schengen", "eu"],
    valid_from: "2026-01-01",
    valid_to: "2027-12-31",
    source_label: "European Commission · EES",
  },
  {
    id: "w-etias-2026",
    category: "regulatory",
    severity: "advisory",
    title: "ETIAS authorisation required before departure",
    body: "Visa-exempt visitors must hold an approved ETIAS travel authorisation linked to their passport prior to boarding. Apply at least 96 hours before departure; most approvals issue within minutes.",
    regions: ["it", "fr", "es", "de", "nl", "be", "pt", "at", "schengen", "eu"],
    valid_from: "2026-04-01",
    valid_to: "2027-12-31",
    source_label: "European Commission · ETIAS",
  },
  {
    id: "w-uk-eta",
    category: "regulatory",
    severity: "info",
    title: "United Kingdom Electronic Travel Authorisation (ETA)",
    body: "All eligible non-visa travellers — including U.S. passport holders — now require an approved ETA before boarding any flight to the UK. £10, valid two years.",
    regions: ["gb", "uk", "united kingdom", "london"],
    valid_from: "2025-01-08",
    valid_to: "2027-12-31",
    source_label: "UK Home Office",
  },
  {
    id: "w-fr-strike",
    category: "environmental",
    severity: "advisory",
    title: "Rolling rail strikes anticipated across France",
    body: "SNCF unions have signalled intermittent national rail action through early September. Build buffer time around TGV connections and confirm seat reservations 24 hours prior.",
    regions: ["fr", "france", "paris", "nice", "lyon"],
    valid_from: "2026-08-25",
    valid_to: "2026-09-15",
    source_label: "SNCF · Industry advisory",
  },
  {
    id: "w-it-heatwave",
    category: "environmental",
    severity: "advisory",
    title: "Late-summer heat advisory across southern Italy",
    body: "Sustained temperatures above 35°C are expected through early September. Prioritise climate-controlled transfers and confirm rooftop or terrace reservations are shaded.",
    regions: ["it", "italy", "rome", "naples", "amalfi", "sicily"],
    valid_from: "2026-08-15",
    valid_to: "2026-09-10",
    source_label: "Protezione Civile",
  },
  {
    id: "w-jp-typhoon",
    category: "environmental",
    severity: "advisory",
    title: "Peak typhoon season — Japan",
    body: "Late-August through mid-September is the statistical peak of the western Pacific typhoon season. Maintain flexible inter-city Shinkansen options and review hotel cancellation windows.",
    regions: ["jp", "japan", "tokyo", "kyoto", "osaka"],
    valid_from: "2026-08-20",
    valid_to: "2026-09-30",
    source_label: "Japan Meteorological Agency",
  },
  {
    id: "w-es-health",
    category: "health",
    severity: "info",
    title: "West Nile virus surveillance — Andalusia",
    body: "Regional health authorities are tracking elevated mosquito-borne West Nile activity in inland Andalusia. Standard repellent and evening cover are advised; no travel restrictions in place.",
    regions: ["es", "spain", "seville", "andalusia", "málaga", "malaga"],
    valid_from: "2026-07-15",
    valid_to: "2026-10-15",
    source_label: "Junta de Andalucía · Salud",
  },
];

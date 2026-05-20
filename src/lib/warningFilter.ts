import type { Trip, ItineraryItem } from "@/stores/useTripStore";
import type { TravelWarning } from "@/data/mockTravelWarnings";

// Minimal city/region → ISO country code map for sandbox filtering.
const CITY_TO_COUNTRY: Record<string, string> = {
  paris: "fr", nice: "fr", lyon: "fr", marseille: "fr", cannes: "fr", "antibes": "fr",
  rome: "it", milan: "it", florence: "it", venice: "it", naples: "it", amalfi: "it",
    positano: "it", capri: "it", sicily: "it", palermo: "it",
  madrid: "es", barcelona: "es", seville: "es", malaga: "es", "málaga": "es",
    andalusia: "es", ibiza: "es", mallorca: "es",
  london: "gb", edinburgh: "gb", manchester: "gb", "united kingdom": "gb", uk: "gb",
  tokyo: "jp", kyoto: "jp", osaka: "jp", japan: "jp",
  "new york": "us", "los angeles": "us", miami: "us", chicago: "us",
  berlin: "de", munich: "de", hamburg: "de",
  amsterdam: "nl", lisbon: "pt", porto: "pt", vienna: "at", brussels: "be",
};

const SCHENGEN = new Set([
  "fr","it","es","de","nl","be","pt","at","gr","ie","dk","se","no","fi","pl","cz","hu","ch","is","lu","ee","lv","lt","sk","si","mt",
]);

function tokensFromText(text: string | null | undefined): string[] {
  if (!text) return [];
  return text.toLowerCase().split(/[\s,;/]+/).filter(Boolean);
}

export function collectTripRegionTags(
  trip: Trip | null,
  items: ItineraryItem[],
): Set<string> {
  const tags = new Set<string>();
  const sources: string[] = [];
  if (trip?.destination) sources.push(trip.destination);
  if (trip?.name) sources.push(trip.name);
  for (const it of items) {
    if (it.location_name) sources.push(it.location_name);
    if (it.title) sources.push(it.title);
    if (it.description) sources.push(it.description);
  }
  const haystack = sources.join(" ").toLowerCase();
  for (const [city, code] of Object.entries(CITY_TO_COUNTRY)) {
    if (haystack.includes(city)) {
      tags.add(city);
      tags.add(code);
      if (SCHENGEN.has(code)) {
        tags.add("schengen");
        tags.add("eu");
      }
    }
  }
  // also include raw tokens for free-text matches
  for (const t of tokensFromText(haystack)) tags.add(t);
  return tags;
}

function datesOverlap(
  aStart: string | null,
  aEnd: string | null,
  bStart: string,
  bEnd: string,
): boolean {
  if (!aStart || !aEnd) return true; // be permissive if trip dates missing
  return aStart <= bEnd && bStart <= aEnd;
}

export function filterWarningsForTrip(
  warnings: TravelWarning[],
  trip: Trip | null,
  items: ItineraryItem[],
): TravelWarning[] {
  if (!trip) return [];
  const tags = collectTripRegionTags(trip, items);
  return warnings.filter((w) => {
    const regionHit = w.regions.some((r) => tags.has(r.toLowerCase()));
    if (!regionHit) return false;
    return datesOverlap(trip.start_date, trip.end_date, w.valid_from, w.valid_to);
  });
}

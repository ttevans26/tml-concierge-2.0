import type { ChecklistTask, Trip, ItineraryItem } from "@/stores/useTripStore";
import { collectTripRegionTags } from "@/lib/warningFilter";

type DerivedTask = Omit<ChecklistTask, "id" | "is_completed" | "is_ai_generated" | "dismissed"> & {
  context_trigger: string;
};

interface Rule {
  id: string;
  predicate: (ctx: { trip: Trip; items: ItineraryItem[]; tags: Set<string> }) => boolean;
  build: (ctx: { trip: Trip; items: ItineraryItem[] }) => Omit<DerivedTask, "trip_id">;
}

const IDP_COUNTRIES = new Set(["it", "es", "jp"]);
const RENTAL_REGEX = /(car\s*rental|rental car|hertz|avis|sixt|europcar|enterprise|budget rent)/i;

const RULES: Rule[] = [
  {
    id: "idp-required",
    predicate: ({ items, tags }) => {
      const hasRental = items.some(
        (i) =>
          i.category === "logistics" &&
          (RENTAL_REGEX.test(i.title || "") || RENTAL_REGEX.test(i.description || "")),
      );
      if (!hasRental) return false;
      return [...IDP_COUNTRIES].some((c) => tags.has(c));
    },
    build: () => ({
      task_text: "Obtain an International Driving Permit (IDP)",
      detail:
        "Italian, Spanish, and Japanese law require an IDP alongside your license. Available at any AAA branch for ~$20 with two passport photos — issued on the spot.",
      context_trigger: "logistics.car_rental",
    }),
  },
  {
    id: "passport-eu-validity",
    predicate: ({ tags }) => tags.has("schengen") || tags.has("eu"),
    build: () => ({
      task_text: "Verify biometric passport valid 3+ months past return date",
      detail:
        "EES enrolment requires a biometric (chipped) passport. Schengen entry rules also require validity at least three months beyond your planned departure from the area.",
      context_trigger: "regulatory.ees_etias",
    }),
  },
  {
    id: "uk-eta",
    predicate: ({ tags }) => tags.has("gb"),
    build: () => ({
      task_text: "Apply for UK Electronic Travel Authorisation (ETA)",
      detail:
        "Required before boarding any UK-bound flight. £10, valid two years, typically approved within minutes via the UK ETA app.",
      context_trigger: "regulatory.uk_eta",
    }),
  },
  {
    id: "mail-hold",
    predicate: ({ trip }) => {
      if (!trip.start_date || !trip.end_date) return false;
      const ms = new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime();
      return ms / (1000 * 60 * 60 * 24) > 7;
    },
    build: () => ({
      task_text: "Arrange mail and package hold for the duration of the trip",
      detail:
        "USPS Hold Mail and most carrier vacation holds can be scheduled online up to 30 days in advance.",
      context_trigger: "duration.gt_7d",
    }),
  },
  {
    id: "flight-checkin",
    predicate: ({ trip, items }) => {
      if (!trip.start_date) return false;
      const days = (new Date(trip.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (days < 0 || days > 14) return false;
      return items.some(
        (i) =>
          i.category === "logistics" &&
          /(flight|airline|airways|delta|united|american|ana|jal|ba\b|air france|lufthansa)/i.test(
            `${i.title} ${i.description ?? ""}`,
          ),
      );
    },
    build: () => ({
      task_text: "Confirm 24-hour online check-in window for outbound flight",
      detail: "Most carriers open online check-in exactly 24 hours before scheduled departure.",
      context_trigger: "flight.checkin_window",
    }),
  },
];

export function deriveAiTasks(trip: Trip | null, items: ItineraryItem[]): ChecklistTask[] {
  if (!trip) return [];
  const tags = collectTripRegionTags(trip, items);
  const derived: ChecklistTask[] = [];
  for (const rule of RULES) {
    if (!rule.predicate({ trip, items, tags })) continue;
    const built = rule.build({ trip, items });
    derived.push({
      id: `ai-${trip.id}-${rule.id}`,
      trip_id: trip.id,
      is_completed: false,
      is_ai_generated: true,
      ...built,
    });
  }
  return derived;
}

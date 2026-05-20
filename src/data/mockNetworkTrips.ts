import type { NetworkTripSummary, NetworkTripItem } from "@/stores/useTripStore";

export const MOCK_NETWORK_TRIPS: Record<string, NetworkTripSummary[]> = {
  "nu-eloise": [
    {
      id: "ntrip-eloise-kyoto",
      owner_id: "nu-eloise",
      name: "Kyoto in Autumn",
      destination: "Kyoto, Japan",
      start_date: "2026-10-12",
      end_date: "2026-10-18",
      item_counts: { stays: 1, dining: 4, activity: 3, logistics: 2 },
    },
    {
      id: "ntrip-eloise-lisbon",
      owner_id: "nu-eloise",
      name: "Long Weekend in Lisbon",
      destination: "Lisbon, Portugal",
      start_date: "2026-11-06",
      end_date: "2026-11-09",
      item_counts: { stays: 1, dining: 3, activity: 2, logistics: 2 },
    },
  ],
  "nu-imogen": [
    {
      id: "ntrip-imogen-mexico",
      owner_id: "nu-imogen",
      name: "Mexico City Long Weekend",
      destination: "Mexico City, MX",
      start_date: "2026-09-25",
      end_date: "2026-09-28",
      item_counts: { stays: 1, dining: 4, activity: 2, logistics: 2 },
    },
  ],
  "nu-saskia": [],
  "nu-marcus": [],
  "nu-hiroshi": [],
};

const day = (start: string, offset: number) => {
  const d = new Date(start + "T00:00:00");
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

export const MOCK_NETWORK_TRIP_ITEMS: Record<string, NetworkTripItem[]> = {
  "ntrip-eloise-kyoto": [
    { id: "i1", trip_id: "ntrip-eloise-kyoto", category: "stays", title: "The Mitsui Kyoto", description: "Ryokan-inspired luxury near Nijo Castle.", date: day("2026-10-12", 0), start_time: "15:00", end_time: null, location_name: "Nakagyo Ward, Kyoto" },
    { id: "i2", trip_id: "ntrip-eloise-kyoto", category: "logistics", title: "Haneda → Itami flight", description: null, date: day("2026-10-12", 0), start_time: "09:40", end_time: "10:55", location_name: "HND → ITM" },
    { id: "i3", trip_id: "ntrip-eloise-kyoto", category: "dining", title: "Kichisen Kaiseki", description: "Three-Michelin-star kaiseki dinner.", date: day("2026-10-12", 0), start_time: "19:00", end_time: "21:30", location_name: "Sakyo Ward" },
    { id: "i4", trip_id: "ntrip-eloise-kyoto", category: "activity", title: "Fushimi Inari at sunrise", description: "Walk the torii path before crowds arrive.", date: day("2026-10-12", 1), start_time: "06:00", end_time: "08:30", location_name: "Fushimi Inari Taisha" },
    { id: "i5", trip_id: "ntrip-eloise-kyoto", category: "dining", title: "Omen Nippon noodles", description: null, date: day("2026-10-12", 1), start_time: "12:30", end_time: "13:30", location_name: "Gion" },
    { id: "i6", trip_id: "ntrip-eloise-kyoto", category: "activity", title: "Tea ceremony in Higashiyama", description: null, date: day("2026-10-12", 2), start_time: "10:00", end_time: "11:30", location_name: "Higashiyama" },
    { id: "i7", trip_id: "ntrip-eloise-kyoto", category: "dining", title: "Nishiki Market crawl", description: null, date: day("2026-10-12", 2), start_time: "13:00", end_time: "15:00", location_name: "Nishiki Market" },
    { id: "i8", trip_id: "ntrip-eloise-kyoto", category: "activity", title: "Arashiyama bamboo grove", description: null, date: day("2026-10-12", 3), start_time: "09:00", end_time: "12:00", location_name: "Arashiyama" },
    { id: "i9", trip_id: "ntrip-eloise-kyoto", category: "logistics", title: "Itami → Haneda return", description: null, date: day("2026-10-12", 6), start_time: "17:20", end_time: "18:40", location_name: "ITM → HND" },
  ],
  "ntrip-eloise-lisbon": [
    { id: "l1", trip_id: "ntrip-eloise-lisbon", category: "stays", title: "Santiago de Alfama", description: "Boutique hotel in the old town.", date: "2026-11-06", start_time: "15:00", end_time: null, location_name: "Alfama, Lisbon" },
    { id: "l2", trip_id: "ntrip-eloise-lisbon", category: "logistics", title: "JFK → LIS overnight", description: null, date: "2026-11-06", start_time: "21:15", end_time: "09:30", location_name: "JFK → LIS" },
    { id: "l3", trip_id: "ntrip-eloise-lisbon", category: "dining", title: "Belcanto tasting menu", description: null, date: "2026-11-07", start_time: "20:00", end_time: "22:30", location_name: "Chiado" },
    { id: "l4", trip_id: "ntrip-eloise-lisbon", category: "activity", title: "Sintra day trip", description: null, date: "2026-11-08", start_time: "09:00", end_time: "17:00", location_name: "Sintra" },
    { id: "l5", trip_id: "ntrip-eloise-lisbon", category: "dining", title: "Cervejaria Ramiro", description: "Seafood institution.", date: "2026-11-08", start_time: "20:30", end_time: "22:30", location_name: "Intendente" },
    { id: "l6", trip_id: "ntrip-eloise-lisbon", category: "dining", title: "Pastéis de Belém", description: null, date: "2026-11-09", start_time: "10:00", end_time: "11:00", location_name: "Belém" },
    { id: "l7", trip_id: "ntrip-eloise-lisbon", category: "logistics", title: "LIS → JFK return", description: null, date: "2026-11-09", start_time: "15:45", end_time: "19:50", location_name: "LIS → JFK" },
  ],
  "ntrip-imogen-mexico": [
    { id: "m1", trip_id: "ntrip-imogen-mexico", category: "stays", title: "Casa Polanco", description: "Quiet boutique in Polanco.", date: "2026-09-25", start_time: "15:00", end_time: null, location_name: "Polanco, CDMX" },
    { id: "m2", trip_id: "ntrip-imogen-mexico", category: "logistics", title: "LAX → MEX", description: null, date: "2026-09-25", start_time: "07:40", end_time: "13:20", location_name: "LAX → MEX" },
    { id: "m3", trip_id: "ntrip-imogen-mexico", category: "dining", title: "Pujol", description: "Tasting menu with mole madre.", date: "2026-09-25", start_time: "20:30", end_time: "23:00", location_name: "Polanco" },
    { id: "m4", trip_id: "ntrip-imogen-mexico", category: "activity", title: "Frida Kahlo Museum", description: null, date: "2026-09-26", start_time: "10:00", end_time: "12:30", location_name: "Coyoacán" },
    { id: "m5", trip_id: "ntrip-imogen-mexico", category: "dining", title: "Contramar lunch", description: null, date: "2026-09-26", start_time: "14:00", end_time: "16:00", location_name: "Roma Norte" },
    { id: "m6", trip_id: "ntrip-imogen-mexico", category: "activity", title: "Teotihuacán pyramids", description: null, date: "2026-09-27", start_time: "08:00", end_time: "14:00", location_name: "Teotihuacán" },
    { id: "m7", trip_id: "ntrip-imogen-mexico", category: "dining", title: "Quintonil dinner", description: null, date: "2026-09-27", start_time: "20:00", end_time: "22:30", location_name: "Polanco" },
    { id: "m8", trip_id: "ntrip-imogen-mexico", category: "logistics", title: "MEX → LAX return", description: null, date: "2026-09-28", start_time: "15:00", end_time: "17:10", location_name: "MEX → LAX" },
  ],
};
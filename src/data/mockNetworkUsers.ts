import type { NetworkUser } from "@/stores/useTripStore";

export const MOCK_NETWORK_USERS: NetworkUser[] = [
  {
    id: "nu-imogen",
    name: "Imogen Voss",
    avatar_url: null,
    trips_planned: 12,
    is_public: true,
    status: "none",
  },
  {
    id: "nu-marcus",
    name: "Marcus Aurelio",
    avatar_url: null,
    trips_planned: 4,
    is_public: false,
    status: "none",
  },
  {
    id: "nu-saskia",
    name: "Saskia Klein",
    avatar_url: null,
    trips_planned: 9,
    is_public: true,
    status: "none",
  },
  {
    id: "nu-hiroshi",
    name: "Hiroshi Tanaka",
    avatar_url: null,
    trips_planned: 7,
    is_public: false,
    status: "pending",
  },
  {
    id: "nu-eloise",
    name: "Eloise Marchand",
    avatar_url: null,
    trips_planned: 3,
    is_public: true,
    status: "connected",
  },
];
/**
 * Public surface of the services layer.
 * Components import from `@/services` — never from `@/services/trips` etc.
 * directly, and never from `@/integrations/supabase/client`.
 */
export * as trips from "./trips";
export * as itineraryItems from "./itineraryItems";
export * as notifications from "./notifications";
export * as profile from "./profile";
export * as flights from "./flights";
export { ServiceError } from "./errors";
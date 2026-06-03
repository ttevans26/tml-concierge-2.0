/**
 * Public surface of the services layer.
 * Components import from `@/services` — never from `@/services/trips` etc.
 * directly, and never from `@/integrations/supabase/client`.
 */
export * as trips from "./trips";
export { ServiceError } from "./errors";
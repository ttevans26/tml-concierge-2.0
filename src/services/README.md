# Services layer

This directory is the **single seam** between UI/state and the backend
transport. Today the transport is Supabase JS. Tomorrow it could be a
typed REST client, a Capacitor native bridge, or a tRPC router — and
only the files in this folder need to change.

## Rules

1. **No component imports `@/integrations/supabase/client` directly.**
   Components and Zustand stores call functions from `@/services/*`.
2. Every service function is `async`, returns typed data, and throws
   `ServiceError` on failure (never a raw Supabase error).
3. Services do **not** hold state. They are pure request → response.
   Caching lives in `@tanstack/react-query`; optimistic UI lives in Zustand.
4. Services do **not** know about React. No hooks, no context, no JSX.
   This keeps them reusable from edge functions, native bridges, and tests.
5. Realtime subscriptions stay in stores/hooks — services only do CRUD.

## Migration plan

The 23 files currently importing `supabase` directly will move over
incrementally. New code MUST use services. Existing call sites get
migrated as they are touched. Order:

1. `trips` (this PR — pattern reference)
2. `itineraryItems`
3. `studio` (folders + items)
4. `notifications`
5. `profile` / `userRoles`
6. `tripDocuments` (storage)
7. `concierge` / edge function invokers

When a service is fully wired, delete the corresponding direct
`supabase` imports and add an ESLint rule to forbid re-introducing them
outside `src/services/` and `src/integrations/`.
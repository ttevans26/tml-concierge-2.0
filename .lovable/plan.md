# Fix Preview: Missing Observability Dependencies

## Diagnosis

Vite is failing to resolve two imports, which crashes the preview:

```
posthog-js     (imported by src/lib/observability/posthog.ts)
@sentry/react  (imported by src/lib/observability/sentry.ts)
```

Both modules are imported by `src/lib/observability/` but were never added to `package.json`.

## Fix

Install the two packages:

- `bun add posthog-js @sentry/react`

That alone should bring the preview back. After install Vite will auto-restart and the "open in new tab" link will work.

No code changes required — both files already guard on `import.meta.env` so they no-op if env vars are absent.

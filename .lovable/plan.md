The blank screen is caused by `ConnectionsList` selecting a freshly filtered array directly from Zustand on every render:

```ts
useTripStore((s) => s.networkUsers.filter(...))
```

React treats that as a new snapshot each time, causing an infinite update loop and the runtime error: `Maximum update depth exceeded`.

Plan:
1. Update `src/components/network/ConnectionsList.tsx` to select the stable `networkUsers` array from the store.
2. Derive `connections` with `useMemo` inside the component so the filtered array is cached between renders.
3. Re-open `/network` in the preview and confirm the Travel Network page renders instead of the white blank screen.
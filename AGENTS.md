# Agent / contributor rules

Read this before changing Astro routing, SSR, or navigation.

## LOCK: automatic link prefetch is forbidden

**Do not re-enable Astro automatic link prefetch.**

### Why (production incident)

`ClientRouter` from `astro:transitions` enables **hover/viewport prefetch of full SSR pages** unless config disables it. Concurrent prefetch GETs overload SSR and surface as **HTTP 503** under load (same class of failure as docs CF under hover storms).

### Required config

In `astro.config.mjs`:

```js
prefetch: false,
```

Do **not**:

- set `prefetch: true`
- set `prefetch: { prefetchAll: true }` or default hover prefetch
- remove `prefetch: false`
- call `init({ prefetchAll: true })` from app code
- add `data-astro-prefetch` on links to SSR pages
- re-enable “prefetch all” via any Astro/Vite plugin

### Allowed

- Keep `<ClientRouter />` for **click** view transitions
- Manual `prefetch()` for one critical URL only if load-tested and documented here

### Verify before merge

```sh
rg -n "prefetch" astro.config.mjs
rg -n "prefetchAll|data-astro-prefetch|prefetch:\\s*true" src/ astro.config.mjs
```

Or run: `bun run check:no-prefetch`.

# E2E tests

Playwright e2e specs live in the top-level `e2e/` directory (config:
`playwright.config.js`), not here. They are named `*.e2e.js` so Vitest never
picks them up.

Run locally:

```bash
npm run build            # specs run against the production build via vite preview
npx playwright install   # one-time: download browsers
npm run test:e2e         # or: npm run test:e2e:ui
```

CI runs them in `.github/workflows/e2e.yml`.

The current suite is **backend-independent** (it proves the build is served and
the React shell boots). Data-driven flows — auth, dispatch, payments, customer
self-service — need a seeded Base44 tenant and should be added as a separate,
backend-backed suite once a test tenant is available.

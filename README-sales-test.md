# Railway Sales test frontend

Select GitHub branch `test/sales-20261014`, repository root `/`, Dockerfile builder. This builds the real API-connected Sales page (quotations, revisions and sales orders), customer register and permission-protected company settings. Other business pages are not routed or imported by the Sales page. Login and password change remain available; server authorization still applies.

Set `API_UPSTREAM=https://YOUR-BACKEND-DOMAIN` with no trailing slash or path. Nginx proxies `/api/v1` to that backend while the browser uses the frontend origin, preserving secure refresh cookies. Railway supplies `PORT`; `/health` is the frontend healthcheck. Configure the exact frontend HTTPS origin in the backend's `Cors__AllowedOrigins__0`.

Connect the separate Backend test service and database first, then generate a frontend domain and set the matching CORS origin. Use the backend's new test administrator (not local development credentials). Complete its password change, configure Settings, create fictitious customers, then test Sales.

Git push alone does not select Railway's watched branch, create service variables, assign domains or copy data. Source from earlier demo milestones remains in repository history, but production builds include only the Sales routes and their dependencies.

Isolation smoke: set `SALES_TEST_URL`, `SALES_TEST_USERNAME`, `SALES_TEST_PASSWORD` privately, then run `npx playwright test --config playwright.sales.config.ts`. It checks real login, Sales API access, removal of unrelated endpoints, finance export denial and restricted navigation. Existing preview-only `serve` development dependency has an npm audit advisory; it is not installed in the final Nginx runtime image.

Verified locally: production Angular build and Linux Nginx Docker build passed; four affected API-backed UI cases plus the dedicated Sales isolation smoke passed. Railway service selection, variables, domain and live deployment have not been verified from this workspace.

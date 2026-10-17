# DEV and Sales UAT

| Branch | Railway environment | Build |
|---|---|---|
| `dev` | existing `Develop` (DEV) | `Dockerfile.dev`: optimized full workspace, all current role modules |
| `uat` | `UAT` | `Dockerfile`: optimized Sales-only interface |
| `main` | unchanged | Existing release history |

Features are reviewed through `feature/runtime-hardening`, `feature/sales-uat`, `feature/workspace-native` and `feature/design-native`. Old demo feature branches remain untouched. Do not merge the full DEV branch into Sales UAT just to release Sales.

Set Railway source branches per environment. DEV must select the `railway.dev.json` config file; UAT uses `railway.json`. Set `API_UPSTREAM=http://<backend-service>.railway.internal:8080` using the Backend service actually present in that environment. A hostname alone is invalid. Configure matching Backend CORS origins and independent database/storage/signing keys. No credential belongs in this repository.

The full workspace exposes the currently implemented role pages. Some modules still have read-only or incomplete transactional behavior; DEV deployment does not imply all-module production acceptance. UAT remains restricted to Sales routes with real Backend authorization; it is not a demo adapter.

Smoke-check encrypted Sales login, refresh after reload, create/edit quotations, customer/product selection, Design handoff references, revision pricing, issued PDF and scope denials before accepting UAT. Review build/deployment logs and public URLs; a pushed branch alone is not a successful deployment.

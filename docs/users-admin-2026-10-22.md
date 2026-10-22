# User/Station native maintenance — 22 October 2026

The full workspace's `/users` route now uses native API-backed maintenance instead of the previous read-only page. Create HUMAN/STATION accounts, edit profile, assign existing roles/stations, reset password/PIN/MFA, enable/disable, revoke sessions and unlock password/PIN lockouts. Permission/scope enforcement and capabilities come from the matching Backend. Username/account type remain immutable; custom per-user grants editing remains open.

Writes use required Idempotency-Key and expectedVersion (MFA uses credential version). Security changes require a reason. Dirty close, lowerCamel field errors, stale conflict/reload, and uncertain response replay preserve the user's work. Credentials are masked and cleared after close. The exact original command is retained until a lost response's outcome is known. Detail actions are disabled during command/detail refresh to avoid ignored clicks.

Local acceptance uses the actual native API with disposable PostgreSQL16/18. Full suites passed19 unit +110 integration/browser tests each with no skips; the final browser extension for stale edit/reload and the resulting timing fix passed separately on both. Frontend43 unit tests and workspace production build passed. Native OpenAPI DTOs were regenerated. No shared DB, migration, seed, storage or Production change. The existing Design stylesheet warning6.83KB/4KB remains.

Four viewport screenshots were visually checked and preserve the exact viewport dimensions:

- [1920×1080](evidence/users-admin-2026-10-22/users-profile-1920x1080.png)
- [1194×834](evidence/users-admin-2026-10-22/users-profile-1194x834.png)
- [834×1194](evidence/users-admin-2026-10-22/users-profile-834x1194.png)
- [390×844](evidence/users-admin-2026-10-22/users-profile-390x844.png)
- [Station creation popup](evidence/users-admin-2026-10-22/users-create-station.png)
- [Browser result](evidence/users-admin-2026-10-22/users-browser-result.json)

This is a feature-branch/local checkpoint, not all-feature/UAT acceptance. DEV rollout remains blocked by Railway refusing new deploys. Do not release this frontend against the old User API. G0/F03 remain open for per-user grants/customer/plant/warehouse boundaries and other approved security/operations requirements.

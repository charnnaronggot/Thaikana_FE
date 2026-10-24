# QC product/group assignment selection

The assignment popup must retain the chosen product after asynchronous option loading, enable Save when its group changes, and preserve both choices when continuing dirty edits or reloading after a409 conflict.

Use Angular's select value accessor to restore/commit the product selection instead of resetting the native DOM value alongside a cached `[value]` binding. Keep the chosen group in a signal. Programmatic control updates suppress view-to-model events to avoid recursively entering the selection handler. Existing server contracts, expectedVersion, idempotency and authorization are unchanged.

Validation: optimized full-workspace build and43 Vitest cases passed. Actual Chromium regression exercised encrypted DEV login/read requests and intercepted only QC mutation/conflict responses, verifying selection, dirty continue,409 reload/new version/new key, four viewport sizes and zero page errors. It performed no hosted business writes. This is frontend boundary evidence, not a claim that PostgreSQL integration/full UAT passed. Current isolated PostgreSQL verification is blocked by the Local Docker engine; previous failed runs remain in the workspace evidence. No auth/PIN implementation or migration is part of this change.

DEV currently serves one factory. Multi-factory capability is deferred; keep existing IDs and required Role/Station/document/stock checks.

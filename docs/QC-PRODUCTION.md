# QC → accepted finished goods

Full-workspace routes now use the native API, generated native OpenAPI contracts and current permission policy. The old demo QC component remains a reference; it is not the active QC route.

- `/qc`: searchable ready work and Draft/Final results; create popup freezes the inspection requirements. Status choices remain available when a filter returns no rows. The settings link uses a server-derived capability.
- `/qc/settings`: QC group popup, checklist/photo-slot Draft editor, immutable published revisions and product-group assignment popup. Dirty exits require a decision; stale assignment reload reads the exact product even when it is outside the current search page.
- `/qc/inspections/:id`: full inspection page, partial Draft results/quantities/remark, four-side protected photo previews/history, replacement/removal, explicit legacy review, source/root context drawer and final quantity/evidence confirmation. A published/final conflict keeps a readable copy of unsaved work.
- Inventory's `รับสินค้าผ่าน QC` popup reads actual accepted entitlement, remaining quantity, same-plant locations and lot. `?qc=` preserves source context from QC. Rework remains a separate Planning action.

Unknown-commit photo and stock commands retain their key/payload/file for retry. New stale commands require refresh and preserve user inputs. Failed/invalid images do not satisfy a required slot. Native file downloads authorize every original/history image; no public object URLs are exposed.

Inventory forms also block opening another stock form while a finished-goods or rework-input lookup is pending. Actual browser acceptance delays the real FG response and verifies those buttons remain disabled, then continues the unknown-commit receipt retry and ledger checks. Final focused QC/rework browser run passed3/3 on PostgreSQL18; Frontend43 unit tests and workspace build passed. Full API/browser regression179 each PG16/18 is recorded with final affected reruns in the dated workspace checkpoint; this is not full UAT certification.

Use `npm run build:workspace` for all-role verification and `Dockerfile.dev` for DEV. `npm run build` is still the original Sales configuration. Browser acceptance is driven by Backend `QualityBrowserTests` against actual disposable PostgreSQL through a test bridge, including encrypted login, dirty popup exits, stale assignment, upload/receipt response loss and four viewports. Screenshots and results belong in the dated workspace checkpoint; this file does not declare full Feature/Gate/UAT completion.

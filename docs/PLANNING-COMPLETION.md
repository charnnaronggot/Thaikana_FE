# Planner remainder popup

Planning → Work orders → detail → target/remainder → Cancel remainder.

Shows original plan, explicit cancellations, current target, actual FG receipts, protected output and real material returns. Number/reason are required and the proposed new target is visible before submission. Store posts physical returns; the popup never invents stock movements.

X/Cancel/Escape prompt before discarding edits. Conflict reload preserves quantity/reason. A lost response locks new commands until the exact key/body is checked again. Existing parent-form close guards include this popup.

Generated native contracts: WorkOrderCompletionPreview and CancelWorkOrderRemainder. Use matching Backend; no DemoStore adapter is used by this workspace. The server enforces authorization, version, readiness, quantity and closure rules.

Checks: frontend43 tests/workspace build passed (existing Design stylesheet budget and Vitest ESM warnings); actual API/browser flow passed within full163-case suites on PostgreSQL16/18,0 skipped. Screenshots:1920×1080,1194×834,834×1194,390×844. New WO rework and full UAT acceptance remain open.

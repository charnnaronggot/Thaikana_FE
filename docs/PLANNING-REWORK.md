# Planner repair page and Store WIP handoff

The full-page /planning/rework/:id route creates a separate DRAFT repair WO through typed native APIs. Planner selects an eligible QC/problem source, original process step, quantity/dates/reason and optional additional repair materials. Published process/cost context stays frozen; additional material costs are visible only with the corresponding permission.

Planning detail links source/root work orders and shows physical WIP readiness. Store uses the Inventory popup to confirm actual transfer or unused return with quantity/reason/history; this does not fabricate raw-material or FG stock. Cancel remainder displays required WIP returns and distinguishes FG target from original input budget after Scrap.

Both forms preserve values on conflict, support dirty confirmation, and lock uncertain commands for same-key retry after a response is lost. Mobile actions sit above footer navigation; the redundant floating menu is hidden where the footer already supplies Menu. Footer navigation exposes expanded state and Escape closes it.

Acceptance uses the built app with a bridge to actual isolated API/PostgreSQL: Planner create with conflict and lost response, review/reserve/Release, Store transfer with dirty exit and lost response, raw-material Issue and Start readiness. Four viewport sizes are captured at top and bottom. This is a checked feature increment, not a claim that all 48 flows or Production readiness are complete.

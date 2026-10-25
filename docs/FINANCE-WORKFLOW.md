# Finance workspace

Routes `/finance` and `/finance/:kind/:id` use the current native API and generated `contracts/native-openapi.json` types. No demo adapter is used by this workspace. Finance opens its own role home; Sales can enter the owned invoice/billing draft workflow. Station and roles without `finance.view` cannot enter.

The workspace separates Invoice, outstanding, billing, payment, receipt and Credit/Debit views. Status choices are stable across empty/filter results. Detail pages show source documents, current outstanding, unallocated money, private evidence and history. Ordinary input uses a popup with validation, safe X/Escape/cancel and dirty confirmation.

Invoice forms choose SO or delivered round, due date and quantities. Prices, discounts and tax come from the accepted SO on the server. Payment drafts show actual received money, invoice allocations and unallocated balance separately; additional invoice search supports the same customer. Saving a draft does not confirm real money. Finance reviews evidence and confirms using a separate explicit action. Reversal preserves the old payment/receipt and returns outstanding.

Pending commands keep the original actor/key/body and file fingerprints in the same tab. Credentials and file bytes are not persisted. A reload checks the original server receipt before creating another command; retry uses the original key and payload. Transactional actions require an online connection. Private files and PDF statuses/downloads/retry use financial scope on the server, including blocking old non-VOID receipt outputs after reversal.

The native API is the owner of contracts and schema. Generate clients with `npm run api:generate:native`, build the complete workspace with `npm run build:workspace`, and run `npm test`. Native browser acceptance uses the Backend `FinanceWorkflowTests` against disposable PostgreSQL and this built frontend, including lost responses after commit and the four required viewport sizes. Code/build/screenshots alone do not certify full feature/UAT readiness.

This increment also corrects the QC product assignment selector to use a reactive FormControl, preserving a selected product when a dirty dialog is cancelled and when asynchronous search refreshes its options.

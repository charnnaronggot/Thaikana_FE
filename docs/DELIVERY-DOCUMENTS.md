# Delivery label workflow

Delivery → package → ดูฉลาก keeps the SVG preview and adds private server PDF generation/history/download/retry. The native API/OpenAPI owns snapshots and permission/version checks. Printing never creates another package or stock posting. Cancelled labels remain visible as history and cannot be downloaded as usable shipping labels.

The UI uses the existing pending-command store: the original key/body/actor survive an unknown response; reload checks its saved result before allowing another action. A closed dialog is not reopened after a normal in-flight completion; deliberate result recovery may reopen the relevant package. Status, errors and refresh actions are shown inside the dialog, including on390px screens. Sources remain online-only; credentials/file bytes are not stored in the pending receipt.

This increment also retains QC product/group intent when a native selection event was queued during async search. Dirty confirmation and conflict handling remain active. Build/unit/native browser checks and four-viewport evidence are recorded in the workspace checkpoint; physical device acceptance and full G4/UAT remain separate.

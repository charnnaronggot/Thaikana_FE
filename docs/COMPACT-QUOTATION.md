# Compact quotation form — 26 October 2026

The creation dialog opts into `app-overlay density="compact"`. Density changes actual spacing/control styles; there is no CSS zoom/transform or browser setting dependency. Default dialogs retain their previous layout.

- Replace the full-width framed product-type switch with quiet, compact choices.
- Put Requirement first; group quantity/unit/optional product code together. On mobile, code gets its own full-width row.
- Reduce repeated borders/padding, textarea height, header/footer padding and duplicate guidance. One neutral hint explains that pricing follows ready design/costs.
- Keep fields labelled, company VAT rules, optional code, Existing/Made By Order behavior, prepend-with-preserved-data, cost-first pricing and dirty/unknown-commit logic. No prices are accepted during initial requirement collection.
- Keep mobile controls44px and editable text16px; checkbox/radio sizing is excluded from the compact input rule.
- Default the date-only quotation field to the Thai factory calendar (Asia/Bangkok), including before07:00 when UTC is still yesterday. Refresh that default whenever a new draft is opened; existing saved document dates are untouched. Boundary tests cover midnight/year rollover.

Measured on the real Local form: Desktop/tablet line panel394→219px (44% shorter), input40→34px, type choices40→30px, textarea72→60px. Mobile panel578→351px (39% shorter), controls48→44px. Screenshots cover1920×1080,1194×834,834×1194,390×844. Actual API browser checks also cover pricing and data-preserving form interactions; no business records were written by hosted visual smoke.

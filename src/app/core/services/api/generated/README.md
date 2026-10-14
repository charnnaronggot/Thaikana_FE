# API contract generation

`schema.ts` is generated from the running Backend's OpenAPI document, captured in `docs/thaikana/references/openapi.json`.

Start the development API and download `http://127.0.0.1:5247/swagger/v1/swagger.json` into that file, then run `npm run api:generate`. The pinned generator runs in an isolated npm environment because its TypeScript 5 peer differs from Angular 22's TypeScript 6.

Do not edit schema.ts. Angular adapters validate required wire fields and map them to page models. Extend response annotations on the Backend when adding API operations.

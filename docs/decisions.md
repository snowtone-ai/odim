# decisions.md

## D-001: Keep context as canonical source material with source-* filenames
- Decision: Rename numbered context files to context/source-XX-*.
- Reason: pm-zero generates docs/vision.md, docs/decisions.md, and related files; source-* prevents future confusion while preserving canonical inputs.

## D-002: Hand-write the Next.js scaffold
- Decision: Create repository files directly instead of running create-next-app.
- Reason: Network access may be restricted. Direct scaffolding keeps progress deterministic.

## D-003: Use mock provider by default
- Decision: AI_PROVIDER defaults to mock; Gemini-compatible fetch is behind env configuration.
- Reason: Cost-zero principle and safe local verification. Production mode requires explicit env values.

## D-004: Keep full roadmap in tasks.md, but mark current implementation as scaffold complete
- Decision: T001-T002 cover repository and product skeleton; real source ingestion remains T004.
- Reason: A commercial product needs external credentials/data and package installation. The repository should be structurally complete before live integrations.

## D-005: Pin current package versions after registry verification
- Decision: Use Next.js 16.2.6, React 19.2.6, Tailwind CSS 4.3.0, and the current npm-published versions recorded in package.json.
- Reason: The user requested current versions, and npm registry lookups succeeded on 2026-05-24.

## D-006: Use stable Gemini model by default and expose latest alias separately
- Decision: Default AI_MODEL remains gemini-2.5-flash; AI_MODEL_LATEST_ALIAS documents gemini-flash-latest as the moving alias.
- Reason: Google documents stable, preview, latest, and experimental naming. Production should prefer stable model strings; latest aliases may be hot-swapped by Google.

# Odim Product Experience System

Status: active for PUX-001 (2026-08-24)

This document is the concrete visual and interaction contract for the Odim product experience. It replaces the previous black-and-gold presentation layer. The initial UI pass preserved source-backed domain and tenant contracts; the later Huginn/Muninn v3 runtime and review-workflow changes are governed separately in the Decision Log.

## Product strategy

- Core user: a public-markets analyst or research lead monitoring capital-intensive companies, sectors, and locations.
- Core problem: material real-world changes appear across fragmented primary sources before they become a coherent investable narrative.
- Core promise: move from a new signal to a source-verifiable change in an investment view in minutes.
- Primary job: detect, triage, verify, and retain changes in capital fixation before consensus catches up.
- Secondary jobs: compare entities, interrogate evidence with Huginn, maintain watches, and audit how a conclusion was reached.
- North star: weekly analyst-confirmed discoveries with a complete evidence path, paired with declining time-to-verification.
- Differentiator: the evidence path remains visible from source through object and alert to analyst action; AI is an assistant on that path, never the product's organizing metaphor.

Odim is not a generic dashboard builder, a Bloomberg clone, an autonomous trading agent, or a collection of AI summaries. It must not claim that configured or fixture-backed data is live.

## Experience principles

1. **Object before widget.** Organize work around entities, signals, sources, links, and actions instead of dashboard cards.
2. **Evidence stays in view.** Selection reveals provenance inline; routine verification does not require a modal detour.
3. **One primary surface.** Each route has one working canvas and at most one contextual inspector.
4. **Progressive density.** Start with the next useful decision, then reveal filters, traces, and automation detail on demand.
5. **State is local and explicit.** Saved, read, running, empty, failed, and source coverage feedback appears beside the action that caused it.
6. **Motion explains continuity.** Transitions connect selections and context; nothing bounces, floats, or animates only for decoration.

## Cognitive-load contract

The Entity and Alerts workspaces apply these rules as acceptance criteria, not as optional styling guidance. They are grounded in Cowan's review of an approximately four-chunk working-memory limit, NN/g guidance on minimizing interface-imposed cognitive load and progressively disclosing secondary detail, and Apple HIG guidance on hierarchy, disclosure, lists, and predictable placement.

1. **One decision per view.** The first viewport answers one question: which entity or alert needs attention next. It exposes at most four competing attention groups: route context, controls, result list, and the selected summary.
2. **Four facts before detail.** A queue row may expose only identity/title, importance, recency, and one evidence/confidence signal. Descriptions, metrics, provenance records, automation, and traces require selection or disclosure.
3. **Summary before evidence before operations.** A selected object presents its conclusion and next action first, supporting evidence second, and technical or automation detail last. Position and type weight communicate priority; color never carries it alone.
4. **Only one detail surface.** Do not show multiple independent inspectors, expanded records, or automation panes at the same time. Opening a new detail closes or replaces the previous one.
5. **Progressive, reversible navigation.** Desktop may use list/detail split view. Mobile shows list or detail, never both stacked; the detail view has an explicit back action and restores the prior list context.
6. **Stable scanning.** Repeated rows keep labels, dates, confidence, and actions in fixed columns or positions. Primary prose is constrained to `68ch`; secondary metadata is one line until requested.
7. **Plain-language actions.** Labels state the user outcome (`Mark as read`, `Review evidence`, `Save changes`). Japanese copy is authored for meaning and task flow, not translated word-for-word.
8. **No hidden critical state.** Urgency, failed evidence, pending approval, and destructive effects stay visible without expansion; low-priority metadata is hidden first.

Research references:

- Nelson Cowan, *The magical number 4 in short-term memory* (2001): https://pubmed.ncbi.nlm.nih.gov/11515286/
- Nielsen Norman Group, *Minimize Cognitive Load to Maximize Usability*: https://www.nngroup.com/articles/minimize-cognitive-load/
- Nielsen Norman Group, *8 Design Guidelines for Complex Applications*: https://www.nngroup.com/articles/complex-application-design/
- Apple Human Interface Guidelines, *Design principles*: https://developer.apple.com/design/human-interface-guidelines/design-principles
- Apple Human Interface Guidelines, *Disclosure controls*: https://developer.apple.com/design/human-interface-guidelines/disclosure-controls
- Apple Human Interface Guidelines, *Lists and tables*: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables

## Japanese product language

- Japanese mode localizes every product-authored visible string, placeholder, title, status, empty/error message, tooltip, and accessible name. Odim, Huginn, Munin, Meta, API, SEC, Slack, organization names, entity names, identifiers, and source-authored titles remain unchanged.
- Prefer ordinary task language: `entity` becomes `企業・組織` when it means a user-facing object, `source` becomes `情報源`, `trace` becomes `処理経路`, and `fixture` becomes `サンプルデータ`. Preserve a technical loanword only when replacing it would reduce precision.
- Japanese headings are short noun phrases; actions use direct verbs; errors state what failed and the next recovery action. Do not mix an English fallback into a Japanese sentence.
- Built-in templates, statuses, and demo content are product-authored and therefore localized. User-entered content and original evidence titles are not translated.

## Visual direction

The model is Palantir's restrained, precise operational software: dark neutral strata, compact typography, clear object hierarchy, thin dividers, and blue operational focus. Odim does not copy a Palantir screen or component library. Its own signature is the Evidence Thread described below.

### Core palette

Only these six named colors may carry the product identity. Muted text, hover fills, and dividers are alpha derivatives of Text or Signal, not additional brand colors.

| Token | Name | Value | Role |
| --- | --- | --- | --- |
| `--field` | Field | `#0A1016` | application canvas |
| `--surface` | Surface | `#131D26` | rail, inspector, selected strata |
| `--text` | Text | `#E8EFF2` | primary content and icons |
| `--signal` | Signal Blue | `#4C90F0` | primary action, focus, active route |
| `--evidence` | Evidence Cyan | `#5CC6D2` | provenance and verified evidence |
| `--critical` | Critical Coral | `#E2745B` | destructive and urgent states only |

Semantic success and warning colors may be used only for status, never as large backgrounds or navigation identity. Substrate categories use a shared neutral treatment plus icon and text labels; color cannot be their only differentiator.

### Typography

- Interface role: IBM Plex Sans, 14px body, 12px labels, 18px section title, 24px route title. Japanese falls back to the platform sans stack.
- Data role: IBM Plex Mono for time, scores, identifiers, source state, and compact numeric values. Never below 11px; 12px is preferred.
- Editorial role: Spectral is allowed for one short statement on the public landing page only. It is prohibited inside the dashboard.
- Use sentence case. Uppercase is limited to compact state codes no longer than two words.

### Geometry and depth

- Spacing: 4 / 8 / 12 / 16 / 24 / 32px.
- Radius: 0 / 4 / 8px. Use 8px only for overlays and focused inputs.
- Regular work surfaces have no shadow. Popovers, sheets, and modals may use one restrained elevation shadow.
- Separate regions with a 1px hairline, alignment, and background strata. Do not wrap every information group in a bordered container.
- Supported surface roles are `canvas`, `section`, `inset/list-row`, and `overlay`. Never nest an elevated surface inside another elevated surface.
- Lucide is the default icon system. Use 16 or 18px icons, 1.75px stroke, a text label for primary navigation, and no decorative icon badges.

### Signature: Evidence Thread

The Evidence Thread is a thin, functional path connecting `Source -> Entity -> Signal/Alert -> Action`. It appears in evidence timelines, selected map relationships, alert detail, and Huginn citations. It uses Signal Blue for the active object and Evidence Cyan for verified source segments. Motion is limited to the selected thread; inactive paths remain still. It must never become a decorative gradient, glow field, or background illustration.

### Brand marks

- `public/brand/odim-mark.png` is the primary Odim app mark: four evidence brackets converge on open negative space. Three Signal Blue segments represent the operating surface; one Evidence Cyan segment represents a verified source entering the decision.
- `public/brand/huginn-mark.png` is the related Huginn mark: three forward, angular planes resolve into a restrained raven silhouette and source path. It is an assistant identifier, not a mascot.
- Both marks are 512px square, transparent, text-free image-generated assets mechanically normalized to the two exact brand fills. Their visible alpha bounds are tightly cropped for 16px use (Odim 95.3% x 94.5%; Huginn 95.1% x 83.4%), and each optimized PNG stays below 20KB. Render them at a 1:1 ratio without additional cropping, tinting, glow, containing badges, or decorative rotation.
- At small sizes, pair the Odim mark with a text wordmark when product identity would otherwise be ambiguous. Do not place the two marks together merely as decoration.
- The marks share the product palette and geometric language but deliberately avoid runes, gold, literal mythology illustration, AI sparkles, and copied Palantir iconography.

## Layout contract

Desktop:

```text
+------+----------------------------------------------------+
| rail | route context · source status · search / command   |
|      +----------------------------------------------------+
| nav  | command strip: scope · time · filters              |
|      +-----------------------------------+----------------+
|      | continuous working canvas         | inspector      |
|      | map / queue / entity / dialogue   | evidence/action|
|      +-----------------------------------+----------------+
|      | local feedback: saved / failed / source coverage   |
+------+----------------------------------------------------+
```

Mobile:

```text
+------------------------------------------+
| compact route context · status · search  |
+------------------------------------------+
| primary canvas                           |
|                                          |
| selected detail becomes a bottom sheet   |
+------------------------------------------+
| Alerts · Map · Entities · Huginn · More  |
+------------------------------------------+
```

- Desktop rail stays narrow but navigation items include discoverable labels on expansion or tooltip/focus.
- Mobile uses a fixed bottom navigation with 44px minimum targets; it never uses a horizontally scrolling icon strip at the top.
- The inspector is 320–400px on wide screens, collapsible at narrower desktop widths, and a bottom sheet on mobile.
- Route content uses the available viewport. Long lists scroll within their pane so context and primary actions remain visible.

## Route information architecture

### Reality Map

- Purpose: notice a material spatial change and inspect its evidence.
- Primary surface: a dark basemap continuous with the app chrome.
- Command strip: search, time, layer, confidence, and reset; no independent floating control cards.
- Daily changes are a compact rail/ticker on desktop and a collapsible bottom sheet on mobile.
- Selecting an object opens the inspector without obscuring most of the map.
- Map style failure shows a dark fallback, explanation, and retry instead of an endless loader.
- Every relationship preserves `from -> to` coordinate order. A restrained marker travels from the source object to the destination object; reduced-motion mode replaces travel with fixed forward chevrons. Unselected base lines remain quiet so direction motion does not become ambient noise.

### Entities

- Purpose: search an object, understand its current state, and traverse linked evidence.
- Desktop: result index, object workspace, contextual evidence inspector separated by hairlines.
- Mobile: result and detail are mutually progressive views rather than one very long stacked page.
- Zero results provide a visible reset action. Comparisons retain their existing behavior but use a focused overlay.

### Alerts

- Purpose: triage the newest material changes and decide what to inspect or automate.
- Desktop: alert queue and selected case file; automation is a secondary tab or disclosure inside the selected case.
- Mobile: queue first, detail as a full-height sheet/view, no permanently stacked Watchtower section.
- Read, saved, approval, and failure feedback is announced with `aria-live` and shown inline.
- Notification permission is requested only after an explicit action in Alerts or Settings, never globally on entry.

### Huginn

- Purpose: ask a grounded question and follow the answer's evidence path.
- Conversation is the primary canvas. Sources and execution trace share one collapsible inspector.
- Empty state offers concrete investigation starters without filling the canvas with placeholder panels.
- Composer stays reachable. Loading names the current phase; failures appear as retryable state, not appended answer text.
- While a request is pending, reserve one compact inline status row in the conversation flow instead of opening a panel or blocking the composer. Pair the Huginn mark with the MIT-licensed SVG Spinners three-dot fade and cycle neutral phrases such as `Preparing analysis`, `Tracing evidence`, and `Checking support`; these phrases describe user-facing progress and must not claim an exact backend stage.
- Pending status appears within 200ms, keeps a fixed footprint to prevent layout shift, and is announced as a single polite status. Its SVG is decorative, inherits the current text color, and animates only opacity. Reduced-motion mode shows one static phrase and static dots.
- Follow the learned structure shared by major chat products: a collapsible recent-conversation rail, one centered readable conversation column, a persistent bottom composer, and answer-level disclosures for sources and execution detail. Evidence remains attached to the answer it supports instead of becoming a permanent competing dashboard.

### Settings

- Purpose: complete setup and administer data, access, automation, and audit behavior.
- Group existing capabilities under `Getting started`, `Data`, `Access`, and `Audit` while preserving every mutation/API contract.
- One section is visible at a time. Settings rows use dividers, not nested cards.
- Source status distinguishes configured, live-verified, fixture-only, skipped, and failed where the underlying data is available.

### Public and auth

- Lead with the core promise and one visual evidence path, not a three-card feature grid.
- Keep `/login`, `/map`, legal links, and existing auth behavior discoverable.
- Public surfaces share the six-color palette but allow more whitespace and the single Spectral statement.

## Interaction and motion

| Token | Duration | Use |
| --- | ---: | --- |
| `--motion-micro` | 120ms | hover, pressed, icon and focus response |
| `--motion-state` | 180ms | selection, tabs, inline feedback, route entry |
| `--motion-surface` | 280ms | inspector, bottom sheet, disclosure |

- Primary easing: `cubic-bezier(0.2, 0.8, 0.2, 1)`; exit easing: `cubic-bezier(0.4, 0, 1, 1)`.
- Route entry is opacity plus at most 4px translation. Do not stagger every child.
- Buttons use color/border response and `translateY(1px)` on press; never scale or bounce.
- Inspector and mobile sheets preserve the selected object's spatial origin where practical.
- `prefers-reduced-motion: reduce` removes translation, path drawing, pulses, and smooth scrolling while preserving immediate state feedback.
- Map requestAnimationFrame work pauses when hidden; only the selected thread may pulse.

## Responsiveness and performance budgets

- Every tap or key action acknowledges locally within 100ms, even when the remote result remains pending.
- Warm in-product navigation should display its next useful state within 1.5s at P95; keep Next.js prefetching on for primary app navigation and high-intent calls to action, and disable it only for low-intent public/legal links.
- Local search and filtering target 100ms. Remote evidence retrieval targets 1.5s, answer generation 4s, grounding 1s, and the complete Huginn flow 8s at P95 with a hard 12–15s deadline and an explicit recoverable timeout state.
- Dynamically load route-specific heavy libraries such as the map renderer. Avoid global client dependencies, duplicate request waterfalls, uncancelled timers, and render-time recomputation of large filtered collections.
- Performance claims require a production build and browser trace. Development-server timings are diagnostic only and are not reported as product metrics.

## Accessibility and state requirements

- Visible `:focus-visible` ring uses Signal Blue and maintains WCAG 2.2 focus contrast.
- Normal text and controls target WCAG AA; tertiary text is not allowed below 4.5:1 at body sizes.
- Interactive targets are at least 36px desktop and 44px mobile.
- Icon-only controls require accessible names and tooltips on hover/focus.
- Tabs expose `aria-selected`; current navigation/setting uses `aria-current`; toggles expose `aria-pressed` or native checked state.
- Dialogs and sheets trap focus, close with Escape, and restore focus to their trigger.
- Loading, empty, error, success, populated, and long-content states are part of each surface's acceptance criteria.

## Prohibited patterns

- Dashboard card grids or nested panels
- Gold/rune brand treatment, glassmorphism, backdrop blur, large gradients, or broad glow effects
- Giant marketing headings, gratuitous uppercase, or labels below 11px
- Persistent permission prompts, auto-opening modals, or controls that obscure the primary canvas
- Unlabeled color-only statuses, decorative charts, or claims of live coverage unsupported by ingestion state
- New animation or component dependencies unless a specific accessibility primitive cannot be implemented safely with the existing stack

## Technical boundary

During the first UI rebuild, keep server pages, Server Actions, API shapes, repositories, Zustand persistence keys/schema, organization scoping, Evidence GraphRAG, Watchtower, and MapLibre data/layer logic intact. Presentation work owns tokens, layout, shared primitives, route workstations, and state feedback. Later Huginn/Muninn runtime, temporal-memory, proposal-review, and AI-provider changes are explicit contract work with independent tests and Decision Log coverage; they do not silently expand this presentation boundary. Data unification between map demo objects and repository projections remains a separate contract change.

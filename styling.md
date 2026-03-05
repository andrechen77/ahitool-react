## Styling organization for ahitool

### Where styles live

- **Global styles**: `src/index.css`
  - Imports Tailwind: `@import "tailwindcss";`
  - Uses Tailwind’s recommended layers:
    - `@layer base` for app‑wide foundations:
      - `:root` for font family, base colors, and rendering settings.
      - Global `box-sizing` on `*`, `*::before`, `*::after`.
      - `body` reset (margin 0, minimum size, background color).
    - `@layer components` for reusable semantic UI classes that wrap Tailwind utilities.
  - **Guideline**: Put only global, project‑wide rules here (resets, base typography, design‑system components), not page‑specific tweaks.

- **UI primitives (React components)**: `src/components`
  - `Button.tsx`: wraps Tailwind button classes with `variant` (`primary`, `secondary`, `ghost`), `size` (`sm`, `md`), and `icon` support.
  - `Card.tsx`: simple container that applies the shared card style.
  - `Input.tsx`: shared input styling with an optional `size` (`sm`, `md`, `lg`) prop.
  - Feature components (`JnClient`, `ApiKeyModal`, `SalesKpisPage`, etc.) compose these primitives and add layout utilities locally.

### Tailwind CSS usage

- Tailwind is enabled globally via `@import "tailwindcss";` in `index.css`.
  - This makes Tailwind utility classes available in all components without additional imports.
  - You can use Tailwind classes directly in JSX (e.g., `className="flex gap-4"`).
- **When to use Tailwind utilities vs. semantic classes vs. UI primitives**
  - Use **Tailwind utilities** directly for:
    - Layout (`flex`, `grid`, spacing, alignment, `max-w-*`, etc.).
    - One-off styles that are truly local to a single element.
  - Use **semantic component classes** (from `@layer components`) for:
    - Reusable patterns that would otherwise repeat long utility strings.
    - Encapsulating visual decisions under meaningful names:
      - `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-sm`, `.btn-md`, `.btn-icon`
      - `.card`
      - `.input`, `.input-lg`
      - `.table`, `.table-header-row`, `.table-row`, `.table-header-cell`, `.table-cell`, `.table-header-sticky`
      - `.modal-overlay`, `.modal-panel`
      - `.tabs`, `.tab`, `.tab-active`, `.tab-inactive`
      - `.nav-link`, `.nav-link-active`
  - Use **React UI primitives** (`Button`, `Card`, `Input`) when:
    - The element is reused across multiple screens.
    - You want consistent behavior (e.g., disabled state, icon buttons) without re‑implementing props logic.

### Design choices and rationale

- **Global typography and colors (`index.css`)**
  - `:root` sets a modern system‑UI font stack for consistency across platforms.
  - Text color `#0f172a` and background `#f3f4f6` mirror Tailwind’s `slate-900`/`slate-100` palette to keep custom CSS visually compatible with Tailwind.
  - Font smoothing and rendering hints are applied once at the root so that all text benefits without repeating rules.

- **Box sizing**
  - `box-sizing: border-box` is applied to `*`, `*::before`, `*::after` to avoid layout surprises when padding/borders are added.
  - This is a global rule because it should be consistent across every component.

- **Body layout**
  - `body` removes default margin and sets a minimum viewport size, with a light background color.
  - Page layout (full‑height flex column, centered main content) is handled in `App.tsx` via Tailwind utilities instead of custom CSS.

- **Buttons**
  - All buttons share a common base (`.btn`) for typography, rounding, transitions, and focus styles.
  - Variants express semantic intent:
    - `.btn-primary`: high‑emphasis actions (e.g., “Add group”, “Save”, “Generate Sankey Diagram”).
    - `.btn-secondary`: bordered, neutral actions (“Delete last group”, “Update API Key”).
    - `.btn-ghost` + `.btn-icon`: lightweight, icon‑first actions (e.g., the refresh button in `JnClient`).

- **Cards / panels**
  - `.card` is used for content panels like the JobNimbus block and status-group config card.
  - Standardizes radius, border, background, shadow, and padding to keep panels visually consistent.

- **Inputs**
  - `.input` captures the shared input look: rounded border, slate colors, and focus ring.
  - `.input-lg` extends it for larger inputs (e.g., API key field) without redefining the base styles.

- **Tables**
  - Table classes ensure consistent spacing, borders, and sticky headers across both the “Statuses” and “Lead Sources” tables in `JnClient`.

- **Tabs**
  - `.tab`, `.tab-active`, and `.tab-inactive` encapsulate the visual treatment for tab triggers; `JnClient` uses these with a small `cn` helper to toggle active state.

- **Modals**
  - `.modal-overlay` and `.modal-panel` define a single modal look and feel, used by `ApiKeyModal` to keep overlays and panels consistent.

- **Nav links**
  - `.nav-link` and `.nav-link-active` style the pill‑shaped navbar links in `App.tsx`, with inverted colors to distinguish the active route.

### Consistency rules for future work

- **Global vs local**
  - Keep **global** rules in `index.css` (reset, base colors, typography, design‑system component classes).
  - Implement **reusable behaviors** as React primitives in `src/components` (or a `components/ui` subfolder if the set grows).
  - For new features (pages, tools), prefer:
    - Layout via Tailwind utilities directly in JSX.
    - Actions via `Button`, containers via `Card`, and form fields via `Input`.

- **Color and typography**
  - When adding new colors, prefer Tailwind color utilities (e.g., `bg-slate-800`, `text-slate-600`) so everything stays within the same palette.
  - Font family should remain set at `:root`; avoid redefining fonts inside components unless there is a very specific, isolated need.

- **Layout**
  - Use Tailwind’s layout utilities (`flex`, `grid`, `gap`, `p-*`, `m-*`, `max-w-*`) for structuring components.
  - Reach for new semantic classes only when:
    - A pattern repeats across multiple places, and
    - It would otherwise require long, copy‑pasted utility strings.

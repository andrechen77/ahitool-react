## Styling organization for ahitool

### Where styles live

- **Global styles**: `src/index.css`
  - Imports Tailwind: `@import "tailwindcss";`
  - Defines app‑wide foundations:
    - `:root` for font family, base colors, and rendering settings.
    - Global `box-sizing` on `*`, `*::before`, `*::after`.
    - `body` reset (margin 0, minimum size, background color).
  - **Guideline**: Put only global, project‑wide rules here (resets, base typography, layout background), not page‑specific styles.

- **Component / layout styles**: `src/App.css`
  - Contains structural and branding styles for the shell of the app:
    - `.app`: full‑height flex column layout.
    - `.navbar`, `.navbar-brand`, `.navbar-links`, `.nav-link`, `.nav-link.active`: top navigation bar and link states.
    - `.main-content` and its headings / paragraphs: main content area spacing and basic typography.
  - **Guideline**: Use this file for layout/branding that is shared across the main shell. For future components, prefer co-located CSS (or Tailwind utilities) near the component instead of adding everything here.

### Tailwind CSS usage

- Tailwind is enabled globally via `@import "tailwindcss";` in `index.css`.
  - This makes Tailwind utility classes available in all components without additional imports.
  - You can use Tailwind classes directly in JSX (e.g., `className="flex gap-4"`).
- **When to use Tailwind vs. custom CSS**
  - Use **Tailwind utilities** for:
    - Common layout patterns (`flex`, `grid`, spacing, alignment).
    - Standard typography sizes and colors that match Tailwind’s scale.
    - One-off styles local to a specific element.
  - Use **custom CSS classes** (in `App.css` or a component-specific stylesheet) for:
    - Reusable design tokens or patterns that would otherwise repeat many utility classes.
    - Semantically named UI pieces (e.g., a specific toolbar or card style).

### Design choices and rationale

- **Global typography and colors (`index.css`)**
  - `:root` sets a modern system-UI based font stack for consistency across platforms.
  - Text color `#0f172a` and background `#f3f4f6` echo Tailwind’s `slate-900` and `gray-100` to keep custom CSS visually compatible with Tailwind defaults.
  - Font smoothing and rendering hints are applied once at the root so that all text benefits without repeating rules.

- **Box sizing**
  - `box-sizing: border-box` is applied to `*`, `*::before`, `*::after` to avoid layout surprises when padding/borders are added.
  - This is a global rule because it should be consistent across every component.

- **Body layout**
  - `body` removes default margin and sets a minimum viewport size, with a light background color.
  - The primary layout responsibility (flex column, full height) is handled by `.app` in `App.css`, not by `body`, to keep the document structure and app layout concerns separate.

- **App shell (`App.css`)**
  - `.app` uses `min-height: 100vh` and `display: flex; flex-direction: column` so the navbar stays at the top and the content area can grow naturally below it.
  - `.navbar` is a flex container with space-between alignment, a dark background (`#111827`) and light text (`#f9fafb`), matching Tailwind’s neutral/dark palette and keeping contrast high.
  - `.navbar-brand` uses uppercase, modest letter-spacing, and a slightly larger font to make the app title stand out without being oversized.
  - `.navbar-links` arranges links horizontally with a gap, while `.nav-link` styles the buttons as pill-shaped controls with a subtle hover and active state:
    - Neutral, transparent background by default.
    - Slight light overlay on hover.
    - Inverted scheme for `.nav-link.active` (light background, dark text) to clearly signal the selected page.
  - `.main-content` centers the content region, constraining max width for readability and adding generous vertical spacing.
  - Heading and paragraph styles inside `.main-content` are intentionally minimal, giving you room to use Tailwind utilities or component-level styles for more specific designs later.

### Consistency rules for future work

- **Global vs local**
  - Keep **global** rules in `index.css` (reset, base colors, typography, box-sizing).
  - Keep **app shell / layout** rules in `App.css`.
  - For future features (e.g., Sales KPIs tools), prefer:
    - Tailwind classes directly in JSX, and/or
    - Small, component-specific CSS files imported by that component.

- **Color and typography**
  - When adding new colors, prefer:
    - Tailwind color utilities (e.g., `bg-slate-800`, `text-gray-600`) where possible, or
    - Custom values that are close to Tailwind’s palette, to avoid visual clashes.
  - Font family should remain set at `:root`; avoid redefining fonts inside components unless there is a very specific, isolated need.

- **Layout**
  - Use Tailwind’s layout utilities (`flex`, `grid`, `gap`, `p-`, `m-`) for most internal layouts.
  - Reserve custom layout classes (like `.main-content`) for high-level regions that are shared across pages or difficult to express cleanly using only utilities.

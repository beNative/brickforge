# BrickForge Version Log & Changelog

This document logs all released versions of BrickForge, detailing features, updates, and bug fixes.

---

## v1.2.0 — In-App Documentation Viewer (June 2026)

This release adds a built-in documentation reader, making the User Manual and Version Log accessible directly within the application.

### Added

- **Help & Manual Page:** A new sidebar tab (with a `BookOpen` icon) opens an in-app document viewer.
- **Tab Switcher:** Toggle between the **User Manual** and **Release Notes** using stylish gradient-highlighted tabs.
- **Search Filter:** A real-time keyword search filters document paragraphs and highlights all matching terms.
- **Custom Markdown Renderer:** A lightweight regex-based parser renders headings, lists, code blocks, inline code, bold/italic text, links, horizontal rules, and GitHub-style alert callouts (NOTE, TIP, IMPORTANT, WARNING, CAUTION) — all with theme-adaptive styling.
- **Breadcrumb Navigation:** A subtle breadcrumb trail at the bottom of the page shows the current document context.

### Technical

- **Document Service (Backend):** New `documentService.ts` locates and reads bundled `.md` files from the dev root, `resources/`, or the compiled `process.resourcesPath`.
- **IPC Handler:** New `documentHandlers.ts` registers a `read-document` channel.
- **Preload Bridge:** Exposed `readDocument` method on `window.api`.

---

## v1.1.0 — Collection Search & Polished Details Explorer (June 2026)

This release implements direct collection management and an interactive details inspector for catalog inventories.

### Added

- **Direct Add Set Dialog:** Added a "+ Add Set" button in the collection header which launches an inline modal to search the main catalog and add sets directly without switching tabs.
- **Polished Set Details View:** Expanded collection row accordion replaced by a comprehensive Set Details Modal:
  - **Info Column:** Shows high-res image, theme, release year, parts count, and aggregated completeness statistics.
  - **Custom Set Notes:** Integrated a persistent, multi-line notes editor for documenting physical box conditions, instructions, or build notes.
  - **Counting Sessions Tab:** Grouped check session history inside the details modal, offering play (resume), copy (duplicate), and delete triggers, plus a form to quick-start a new session.
  - **Parts Inventory Tab:** Rendered a full scrollable catalog parts table to preview all official parts expected in a set.
  - **Set Parts Filter:** Real-time search and filter controls for the parts inventory tab, filtering catalog parts by ID/Name, Technic Group, and Color.
- **Theme Variables:** Introduced theme-adaptive `--text-secondary` color variable, replacing static gray overrides to resolve text contrast issues in Light Mode.

### Improved

- **UI Layout:** Streamlined Collection view by moving counting history into the details modal, resolving cluttered dashboard rows.
- **Navigation:** Cleaned up unused props and navigation callbacks inside `App.tsx` and simplified sub-route structures.

---

## v1.0.0 — Initial Release (June 2026)

Initial version of BrickForge providing basic Technic set cataloging and inventory verification.

### Features

- **Offline Operation:** Powered by a local SQLite (`better-sqlite3`) database, running fully offline after catalog files are loaded.
- **Rebrickable CSV Importer:** Streaming parser (`papaparse`) to import database dumps (`sets`, `parts`, `themes`, `colors`, `categories`, `inventories`, `inventory_parts`) with transaction-batch speed.
- **Fuzzy Set Search:** Query sets by number, name, or year.
- **Inventory Sessions:** Create checklists to verify pieces. Features card/list views, Technic-categorized tabs, quantity counters, and status badges (Not Checked, Complete, Missing, Extra).
- **Missing Parts Exporter:** Download missing checklists in CSV or JSON formats.
- **Global Theme Toggle:** Seamlessly switch between Glassmorphic Dark Mode and Sleek Slate Light Mode.

# BrickForge Version Log & Changelog

This document logs all released versions of BrickForge, detailing features, updates, and bug fixes.

## v1.8.0 — Expected Quantity Overrides & Cloud Sync Conflict Management (June 2026)

This release introduces expected part count overrides during active check sessions, carriage return markdown parsing fixes on Windows, and fully integrated cloud sync conflict notifications and automatic resolution triggers.

### Added

- **Expected Quantity Overrides:** Allows users to correct incorrect expected part counts during an inventory check session. Hovering over the expected count in Grid or List view exposes an interactive dotted underline trigger; clicking it prompts the user to enter the overridden count, which writes immediately to both the session check item and global database catalog tables in a transaction.
- **Global Sync Conflict Warnings:** Subscribed globally to cloud sync events in the main app layout. An interactive warning banner (**"Sync Conflict Detected"**) appears in the status bar if a conflict halts periodic or startup synchronization.
- **Auto-Open Conflict Resolution:** Clicking the status bar warning redirects the user to the Settings page and automatically launches the conflict comparison and resolution modal.
- **Detailed Sync Logging:** Implemented super detailed logging at all stages of local database backup, checksum calculations, file uploads, file downloads, and comparison checks.
- **Log Panel/Console Level Coloring:** Integrated ANSI colored output in development consoles and matched styles (blue for `INFO`, red for `ERROR`, green for `DEBUG`, and yellow for `WARNING`) in the UI console log viewer.
- **Log Request Deduplication:** Resolved duplicate token refreshes and remote file lists caused by StrictMode render duplicates in dev environments.

### Fixed

- **Markdown Windows Line Endings:** Handled Windows-specific carriage returns (`\r`) in the Help & Manual parser to ensure regex-based formatting parses correctly.

---

## v1.7.0 — BrickLink XML Exporter & Category Mapping Improvements (June 2026)

This release implements a BrickLink Wanted List XML exporter and updates Technic category mapping logic.

### Added

- **BrickLink Wanted List XML Exporter:** Added support for exporting missing parts from check sessions into the standard BrickLink XML Wanted List format. Automatically translates Rebrickable Color IDs to BrickLink Color IDs using a local lookup map.
- **Enhanced Technic Group Auto-Mapping:** Re-structured categorization order and matching criteria in `technicGroups.ts` to improve classification for electronics, pneumatics, suspension, axles, and connectors.

### Improved

- **User Manual Updates:** Documented the new BrickLink XML export format in the manual.

---

## v1.6.5 — Control Alignment & Windows Icon Resolution (June 2026)

This release resolves grid card controls alignment and packages the application window and executable taskbar icons properly.

### Fixed

- **Control Alignment:** Removed bottom margin offset from part quantity controls to align them perfectly vertically with action buttons.
- **Windows Taskbar Icon:** Resolved production app taskbar icon loading using Electron's `nativeImage` to fetch the asset from the unpacked ASAR archive (`app.asar.unpacked`).
- **High-Quality Executable Icon:** Compiled a multi-resolution `.ico` containing standard icon scales to support desktop shortcuts and Explorer views.
- **Build Script Stability:** Transitioned compiler execution to `npx tsc` for robust typechecking in all Windows terminal environments.

---

## v1.6.4 — Keyboard Shortcuts & Navigation (June 2026)

This release implements a keyboard-driven interface in the inventory check sessions. Users can navigate, edit, and mark parts as complete, missing, or reset them using only their keyboard.

### Added

- **Keyboard Navigation (WASD / Arrows):** Navigate cards in Grid View and rows in List View, automatically scrolling active elements into view. Grid navigation dynamically adapts to columns.
- **Count Modifiers:** Press `Space` to set a part to complete, `x` / `Delete` / `Backspace` to mark it missing, and `r` to reset the count.
- **Increment/Decrement:** Use `+` and `-` to adjust quantity values by 1.
- **Inline Input Focus:** Press `Enter` to focus the quantity input box for typing, and press `Enter` again to save and return focus to the card.
- **Active Border Styles:** Subtle and premium glowing borders highlight the active selection.

---

## v1.6.3 — Cloud Sync Setup Documentation Update (June 2026)

This release actualizes the Google Drive cloud synchronization instructions in the User Manual and Settings setup panel to match the latest Google Cloud Console OAuth setup steps.

---

## v1.6.2 — Release Automation Improvements (June 2026)

This release updates the automated release workflows to properly support auto-updates.

### Fixed

- **Release Assets Packaging:** Included build metadata configurations (`dist/*.yml` and `dist/*.blockmap`) in the release runner matrices, enabling `electron-updater` to successfully discover and check version streams.

---

## v1.6.1 — Software Updates & Resizable Console (June 2026)

This release adds manual/automatic update settings and a draggable, resizable log console panel.

### Added

- **Software Updates Configuration:**
  - **Automatic Updates Toggle:** Enable/disable automatic startup update checks, persisting immediately to the user settings.
  - **Check for Updates Button:** Manual check trigger in the settings panel with real-time status banners and automatic integration with the background updater toast download progress.
- **Resizable Log Console Panel:**
  - **Draggable Splitter Bar:** Added a vertical drag handle splitter at the top of the logs console.
  - **Delta-Based Resizing:** Smooth drag actions on document mouse events, clamping heights between 100px and viewport bounds.
  - **Size Persistence:** Saves your preferred console height in `localStorage`, retaining layout preferences across restarts.

---

## v1.6.0 — Google Drive Database Sync (June 2026)

This release implements a private cloud synchronization engine using Google Drive's isolated sandbox space. Users can optionally backup, load, and restore their database across machines using their own Google Cloud Console credentials.

### Added

- **Private Google Drive Sync Panel:** Adds Google Drive setup and configuration controls inside the Settings Page, utilizing the secure `appDataFolder` sandbox.
- **Local OAuth Listener:** Spins up a temporary server on port `52080` to safely exchange authorization codes for refresh tokens and user info, closing automatically on completion.
- **Checksum-Based Conflict Detection:** Calculates database file MD5 hashes to identify local vs. remote modifications.
- **Side-by-Side Conflict Resolution Modal:** Displays file parameters (modified dates, sizes, collections count, active check sessions, notes count) when a sync conflict is detected.
- **Automated Lifecycle Sync:** Configurable options to run background synchronization tasks on application startup and quit events.
- **Dynamic Swapping:** Intercepts active SQLite connections, close files, apply remote database overlays, and reload the UI automatically.

---

## v1.5.0 — Application Settings & Database Maintenance (June 2026)

This release introduces a dedicated Application Settings page, configurable database folder and file name settings, SQLite database optimization commands, and database backup and restore features via compressed ZIP archives.

### Added

- **Application Settings Tab:** A new settings page in the sidebar navigation to configure the database folder and database file name.
- **Dynamic Database Reconnection:** Swaps databases at runtime without requiring an application restart, running migrations automatically when a new path is configured.
- **PowerShell ZIP Backup & Restore:**
  - **ZIP Backup:** Safely copy the open SQLite file to a temporary location, close active file locks, and compress the file into a `.zip` archive.
  - **ZIP Restore:** Uncompress ZIP database backups with header validation (checking `SQLite format 3` magic bytes), safe `.bak` recovery safeguards, and dynamic reconnection.
- **Database Maintenance Commands:** Integrates database optimization controls to run `VACUUM` (compact space) and `REINDEX` (rebuild indexes) directly from the UI.
- **Branding & Visuals:** Incorporates a new 3D isometric app logo in the sidebar, a clickable statusbar showing live database status and catalog counts, and a clean About Dialog overlay linking to the GitHub repository.

---

## v1.4.0 — Auto-Updates & Release Automation (June 2026)

This release introduces an automated background update engine and release packaging workflows.

### Added

- **Background Auto-Updater:** Integrates `electron-updater` with GitHub Releases to check for public updates silently on startup and download them automatically.
- **Sleek Update Toast Notification:** Mounts a global glassmorphic toast notification displaying real-time download percentages and a progress bar.
- **One-Click Relaunch:** Adds a single-click restart prompt to apply updates immediately, or applies updates silently when the application closes.
- **CI/CD Release Workflow:** Implements GitHub Actions runner matrices to package `.exe` (Windows), `.dmg` (macOS), and `.AppImage`/`.deb`/`.snap` (Linux) installers on version tag pushes.

---

## v1.3.0 — Offline Image Caching (June 2026)

This release introduces an offline image cache which stores set and part images directly inside the local SQLite database as BLOBs, allowing the app to display them fully offline.

### Added

- **Offline Image Cache:** Stores downloaded image files (from Rebrickable) directly inside the SQLite database, eliminating external network dependencies during builds/checks.
- **Smart `CachedImage` Component:** Replaces standard HTML `<img>` elements to check local SQLite database storage first via custom `brickforge://` protocol before falling back to HTTP.
- **Auto-Download on Add:** Automatically pulls and caches images in the background when adding new sets to your collection.
- **Collection Sync Button:** Added a header button on the Collection dashboard to download all collection images with real-time download and failure progress indicators.
- **Cache Stats & Purging:** Allows checking total stored images, total disk/database space consumed, and offers a button to clear the image cache.

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

# BrickForge — LEGO Technic Inventory Checker

**BrickForge** is a visual desktop application for checking the completeness of physical LEGO Technic sets. By comparing counted parts against official catalog inventories imported from Rebrickable, it helps users track complete, missing, partial, or surplus parts through dedicated counting sessions.

---

## Key Features

- **Offline-First**: Catalog imports are saved into a local SQLite database, allowing full offline operation.
- **Technic-Oriented Sorting**: Parts are grouped into pin, axle, connector, frame, gear, and suspension categories specifically suited for Technic builders.
- **Multiple Session Support**: Create and manage multiple inventory sessions per set to track completeness over time.
- **High Visual Accuracy**: Uses part images and color name swatches to eliminate ambiguity during physical counting.
- **Missing Parts Exporter**: Export missing or incomplete lists to CSV or JSON formats for parts ordering (e.g., BrickLink/BrickOwl).

---

## Technical Stack

- **Shell & Host**: Electron + Node.js
- **Frontend Framework**: React + TypeScript + Vite
- **Database**: SQLite (via `better-sqlite3` native drivers)
- **CSV Parser**: PapaParse

---

## Installation & Setup

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Windows Build Tools (automatically configured if node-gyp is installed; required for native sqlite module compilation)

### 2. Install Dependencies

Clone the repository and run:

```bash
npm install
```

This automatically runs `electron-builder install-app-deps` in the `postinstall` step to compile the native `better-sqlite3` drivers against the Electron target ABI.

---

## Running BrickForge

### Development Mode

Launch the Vite hot-reloading dev server and Electron app simultaneously:

```bash
npm run dev
```

### Production Build

Type-check, compile, and bundle assets:

```bash
npm run build
```

Build a packaged Windows executable (.exe installers / unpackaged binaries):

```bash
npm run build:win
```

Packaged binaries will be located in the `dist/` directory.

---

## Importing Rebrickable Catalog Data

BrickForge operates fully offline. On first launch, navigate to **Import Data** to populate the local database.

### 1. Download CSV Dumps

Download the following database dumps from [Rebrickable Downloads](https://rebrickable.com/downloads/):

- `colors.csv` (Required)
- `part_categories.csv` (Required)
- `parts.csv` (Required)
- `themes.csv` (Optional, recommended)
- `sets.csv` (Required)
- `inventories.csv` (Required)
- `inventory_parts.csv` (Required)

### 2. Perform the Import

- Click **Browse** next to each table entry on the Import page and choose your downloaded CSV file.
- Click **Import Selected Files** to run the batch importer.
- Large files (like `inventory_parts.csv` containing over a million rows) are parsed in streamed batches and inserted using transaction pools, taking approximately 10-20 seconds.

---

## Current Roadmap

- [x] Streamed CSV parser & SQLite catalog import
- [x] Multi-session counting logs & status metrics (Complete, Partial, Missing, Extra)
- [x] Technic group auto-mapping logic
- [x] Grid card and List compact views
- [x] CSV and JSON missing parts exporter
- [x] Local image cache for offline image BLOB loading
- [x] In-app Document Viewer (Help Docs & Release Notes)
- [x] Application Settings (configurable db folder and file name)
- [x] Database Backup & Restore (ZIP archives) and SQL Maintenance (Vacuum/Reindex)
- [ ] BrickLink XML wanted-list format exporter
- [ ] Rebrickable API synchronization

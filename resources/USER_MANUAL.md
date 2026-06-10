# BrickForge User Manual — LEGO Technic Inventory Checker

Welcome to **BrickForge**! This visual inventory-checking tool runs fully offline, helping you catalog owned LEGO Technic sets, count physical parts, compare them against official inventories, and quickly identify missing or extra elements.

---

## Table of Contents

1. [Setup and Data Import](#1-setup-and-data-import)
2. [Searching and Adding Sets](#2-searching-and-adding-sets)
3. [Managing Your Collection](#3-managing-your-collection)
4. [Set Details Dashboard](#4-set-details-dashboard)
5. [Counting Parts (Inventory Sessions)](#5-counting-parts-inventory-sessions)
6. [Exporting Missing Parts](#6-exporting-missing-parts)
7. [Light & Dark Mode Themes](#7-light--dark-mode-themes)
8. [Offline Image Cache & Sync](#8-offline-image-cache--sync)
9. [Application Settings & Database Maintenance](#9-application-settings--database-maintenance)

---

## 1. Setup and Data Import

Because BrickForge operates entirely offline to respect privacy and rate limits, you must perform a one-time import of the official Rebrickable database tables.

### Getting the Catalog Files

1. Navigate to [Rebrickable Downloads](https://rebrickable.com/downloads/).
2. Download the latest version of the following **6 CSV files**:
   - `colors.csv` (Required)
   - `part_categories.csv` (Required)
   - `parts.csv` (Required)
   - `themes.csv` (Required)
   - `sets.csv` (Required)
   - `inventories.csv` (Required)
   - `inventory_parts.csv` (Required)

### Importing the Data

1. Open BrickForge and navigate to the **Import Data** tab from the sidebar.
2. Click **Browse...** next to each CSV row to locate the downloaded file on your computer.
3. Once a file is selected, click **Import**.
4. A progress bar will stream the CSV rows. Larger files like `inventory_parts.csv` (containing millions of entries) can take up to 20 seconds.
5. Once all rows display a green checkmark, the bottom connection indicator in the sidebar will turn green, saying **"Connected & Ready"**.

> [!NOTE]
> If you ever want to update the catalog definitions with new release data, download the fresh CSV files from Rebrickable and repeat this import process.

---

## 2. Searching and Adding Sets

With the catalog data successfully loaded, you can search for LEGO sets.

1. Navigate to the **Search Sets** tab.
2. Enter a set number (e.g. `42043`), name (e.g. `Mercedes-Benz Arocs`), or release year into the search bar, then click **Search**.
3. Select the desired set card from the results grid. A side panel will slide open displaying details.
4. From the side panel, you can:
   - **Add to Collection:** Click this to add the set to your personal inventory tracker.
   - **Start Counting:** Create a check session to immediately begin counting pieces.
   - **Save Set Notes:** Keep local notes about when or where you purchased the set.

---

## 3. Managing Your Collection

The **Collection** tab is your personal dashboard of owned sets.

- **Filtering & Searching:** Use the search bar to filter sets in your collection by set number or name. Use the dropdown filter to view sets that are _100% Complete_, _Incomplete_, or _Missing Required Parts_.
- **Stats at a Glance:** The list table shows the current completeness progress bar, expected parts count, missing/extra counts, last checked date, and status.
- **Header Actions:** Click **+ Add Set** in the header to open a quick catalog search dialog. This lets you add sets directly without leaving the page.
- **Set Actions:**
  - Click the **Document Icon** (or click the row) to open the detailed set view.
  - Click the **Red Trash Icon** to remove the set from your personal collection. Removing a set from your collection does _not_ delete active count sessions.

---

## 4. Set Details Dashboard

Clicking on any set in your collection table launches the **Set Details Dashboard**. This dashboard is split into two panels:

### Left Panel (Metadata & Notes)

- **Image & Metrics:** Shows a high-res image (if imported), theme details, release year, expected parts count, and aggregated completeness percentages.
- **Custom Notes Editor:** A dedicated field to document set details (e.g., "Missing sticker sheet, instructions box slightly torn").

### Right Panel (Sessions & Catalog)

- **Counting Sessions Tab:** Lists all active check sessions for this set. You can:
  - **Resume (Play Icon):** Re-open the count session.
  - **Duplicate (Copy Icon):** Create a carbon copy of this session (useful to keep backups at different checkpoints).
  - **Delete (Trash Icon):** Delete records permanently.
  - **Start New Counting Session:** Set a name, check the "Include Spares" checkbox, and click _Start Counting_ to initialize a fresh check sheet.
- **Set Inventory Parts Tab:** Displays a complete catalog sheet of all official parts expected in the set.
  - **Interactive Filters:** Search by part name or part number. Filter by **Technic Group** (Pins, Axles, Gears, Liftarms, etc.) or **Color** using dynamic dropdowns.
  - **Metadata Badges:** Show name, ID, category name, Technic group, expected quantity, a color swatch indicating its RGB code, and a yellow **SPARE** tag if the piece is an official Rebrickable spare.

---

## 5. Counting Parts (Inventory Sessions)

When you start or resume counting, you are presented with the **Inventory Session Page**.

1. **Card View vs. List View:** Toggle between a responsive grid of card slots or a compact list layout.
2. **Technic Group Tabs:** Click on specific tabs (e.g. _Pins_, _Axles_, _Gears_) to focus counting on one Technic type at a time.
3. **Fuzzy Search:** Filter parts in the active session by entering names or numbers.
4. **Interactive Counters:**
   - Adjust your counted quantity using the `+` and `-` buttons.
   - Directly type the counted amount into the input box.
   - Click **Checkmark** (in grid card) to quickly mark the item as complete (matches expected quantity).
5. **Item Notes:** Click the pencil/note icon on any part card to record a comment (e.g., "Replaced with alternative black color").
6. **Part Completeness Status:**
   - **Not Checked (Gray):** Quantities have not yet been verified.
   - **Complete (Green):** Count matches expected count.
   - **Missing (Red):** Count is less than expected.
   - **Extra (Purple):** Count exceeds expected.

---

## 6. Exporting Missing Parts

If you finish counting and have missing pieces, you can generate an export file to help order replacements on sites like BrickLink or ToyPro.

1. On the **Inventory Session Page**, click the **Export Missing Parts** button in the header.
2. Select the **Export Format**:
   - **CSV File (\*.csv):** Best to view in spreadsheet editors (Excel, Google Sheets).
   - **JSON File (\*.json):** Best for developers or programmatic importing.
3. Choose the **Filter Parts** rule:
   - _All Missing Parts:_ Export both required build parts and spare parts that are missing.
   - _Required Build Parts Only:_ Excludes spares.
   - _Spares Only:_ Excludes required build parts.
4. Click **Choose Save Location & Export** to select the target directory on your computer and generate the file.

---

## 7. Light & Dark Mode Themes

BrickForge adapts dynamically to your environment. Click the **Sun / Moon icon** at the bottom of the left sidebar navigation to toggle between:

- **Dark Mode (Default):** Premium, glow-effects glassmorphic cards over deep blue-black backdrops.
- **Light Mode:** High-contrast, sleek off-white panels with slate text and vibrant accents.

---

## 8. Offline Image Cache & Sync

To support fully offline usage (e.g., in basements or areas without internet access), BrickForge features a built-in image caching system.

### How it Works

- **Automatic Download:** When you add a new set to your collection, BrickForge automatically triggers background downloads of the main set image and all individual part images.
- **SQLite BLOB Storage:** The downloaded files are stored as binary BLOBs inside your local SQLite database (`brickforge.db`).
- **Custom Protocol:** When displaying images, the application attempts to fetch them from the local database first using the `brickforge://` protocol. It only falls back to fetching online from Rebrickable's CDN if the image is not yet cached locally.

### Syncing Existing Collection

If you imported sets prior to this feature, you can cache their images in bulk:

1. Navigate to the **Collection** page.
2. Click the **Download Images** button in the header.
3. This downloads all missing set and part images in your collection. You will see a live progress display showing completed sets, downloaded images, and any failed requests.

### Cache Stats & Purging

To check your database space usage or purge the cache:

1. Navigate to the **Import Data** tab.
2. View the **Offline Image Cache** sidebar widget to see the total number of cached images and their total size on disk (MB).
3. Click **Clear Cache** to wipe the local image BLOBs and revert the application to loading images online.

---

## 9. Application Settings & Database Maintenance

BrickForge allows configuring database connections and database files, running safety backups, and optimizing search indexes from the **Settings** tab.

### Database Connection Settings

1. Navigate to the **Settings** tab from the sidebar.
2. Under **Database Connection**:
   - **Database Directory Path:** Specifies the folder containing your database. You can manually enter a path or click **Browse** to open your native directory explorer.
   - **Database File Name:** Configures the database file name (must end in `.db`).
3. Click **Apply & Reconnect** to save settings. BrickForge will close its active connection, point to the new location, run database migrations automatically, and reconnect.

### Backup & Restore

- **Database Backup:** Click **Backup to ZIP** to choose a target location on your computer. BrickForge closes the active file locks, clones the database file, and saves it inside a compressed ZIP archive.
- **Database Restore:** Click **Restore from ZIP** and select a previously exported backup ZIP file. BrickForge will extract the file to a temporary folder, verify the SQLite file signature (`SQLite format 3`) for stability, make a backup `.bak` copy of your current active database in case of copy errors, replace the database file, and reconnect.

### Database Maintenance

- **Optimize Database (VACUUM):** Executes the SQL `VACUUM` command to defragment storage space on disk and shrink the database file size.
- **Rebuild Indexes (REINDEX):** Executes the SQL `REINDEX` command to rebuild search indexes. Use this if set or parts queries feel sluggish.


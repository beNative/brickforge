-- Database Schema for BrickForge

CREATE TABLE IF NOT EXISTS sets (
  set_num TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER,
  theme_id INTEGER,
  num_parts INTEGER,
  image_url TEXT
);

CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INTEGER
);

CREATE TABLE IF NOT EXISTS parts (
  part_num TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  part_cat_id INTEGER,
  part_img_url TEXT
);

CREATE TABLE IF NOT EXISTS colors (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  rgb TEXT,
  is_transparent BOOLEAN
);

CREATE TABLE IF NOT EXISTS part_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventories (
  id INTEGER PRIMARY KEY,
  version INTEGER,
  set_num TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_parts (
  inventory_id INTEGER NOT NULL,
  part_num TEXT NOT NULL,
  color_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  is_spare BOOLEAN NOT NULL DEFAULT 0,
  img_url TEXT,
  PRIMARY KEY (inventory_id, part_num, color_id, is_spare)
);

CREATE TABLE IF NOT EXISTS technic_groups (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS part_technic_group_mapping (
  part_num TEXT PRIMARY KEY,
  technic_group_id INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS check_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  set_num TEXT NOT NULL,
  name TEXT NOT NULL,
  include_spares BOOLEAN NOT NULL DEFAULT 0,
  notes TEXT,
  status TEXT NOT NULL, -- 'in_progress', 'completed', 'abandoned'
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS check_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  part_num TEXT NOT NULL,
  color_id INTEGER NOT NULL,
  expected_qty INTEGER NOT NULL,
  counted_qty INTEGER, -- NULL means not checked
  is_spare BOOLEAN NOT NULL DEFAULT 0,
  status TEXT NOT NULL, -- 'not_checked', 'complete', 'missing', 'partial', 'extra'
  notes TEXT,
  source_img_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES check_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS set_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  set_num TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_collection (
  set_num TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  FOREIGN KEY (set_num) REFERENCES sets(set_num) ON DELETE CASCADE
);


-- Recommended Indexes
CREATE INDEX IF NOT EXISTS idx_sets_name ON sets(name);
CREATE INDEX IF NOT EXISTS idx_sets_year ON sets(year);
CREATE INDEX IF NOT EXISTS idx_parts_name ON parts(name);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_inventory_id ON inventory_parts(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_parts_part_num ON inventory_parts(part_num);
CREATE INDEX IF NOT EXISTS idx_check_items_session_id ON check_items(session_id);
CREATE INDEX IF NOT EXISTS idx_check_items_status ON check_items(status);
CREATE INDEX IF NOT EXISTS idx_check_sessions_set_num ON check_sessions(set_num);

-- Insert Default Technic Groups if they do not exist
INSERT OR IGNORE INTO technic_groups (id, name, sort_order) VALUES
  (1, 'Pins', 1),
  (2, 'Axles', 2),
  (3, 'Bushes', 3),
  (4, 'Connectors', 4),
  (5, 'Liftarms', 5),
  (6, 'Frames', 6),
  (7, 'Panels', 7),
  (8, 'Gears', 8),
  (9, 'Differentials', 9),
  (10, 'Steering and suspension parts', 10),
  (11, 'Wheels and tyres', 11),
  (12, 'Pneumatics', 12),
  (13, 'Linear actuators', 13),
  (14, 'Electronics', 14),
  (15, 'Hoses, strings and flex parts', 15),
  (16, 'Stickers', 16),
  (17, 'Other', 17);

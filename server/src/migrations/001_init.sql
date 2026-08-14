CREATE TABLE IF NOT EXISTS admin_user (
  id INT PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_username (username),
  CHECK (id = 1)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS parameter_limits (
  param_key VARCHAR(64) PRIMARY KEY,
  label VARCHAR(200) NOT NULL,
  min_value DOUBLE NOT NULL,
  max_value DOUBLE NOT NULL,
  step_value DOUBLE NOT NULL DEFAULT 1,
  default_value DOUBLE NOT NULL,
  unit VARCHAR(20) NOT NULL DEFAULT '',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (min_value <= max_value),
  CHECK (default_value BETWEEN min_value AND max_value)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS colors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  series VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  hex VARCHAR(7) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_colors_series_name (series, name),
  KEY idx_colors_series (series, sort_order),
  CHECK (hex REGEXP '^#[0-9A-Fa-f]{6}$'),
  CHECK (active IN (0, 1))
) ENGINE=InnoDB;

-- default_slot: cot sinh tu dong = role khi is_default=1, nguoc lai NULL. MySQL coi nhieu
-- NULL la khac nhau trong UNIQUE INDEX, nen rang buoc nay chi chan duoc > 1 font mac dinh
-- CUNG mot role — tuong duong partial unique index cua SQLite ban dau (khong the dung
-- WHERE trong index o MySQL), giu nguyen bat bien "moi role toi da 1 font mac dinh".
CREATE TABLE IF NOT EXISTS fonts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role VARCHAR(10) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  format VARCHAR(10) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  default_slot VARCHAR(10) GENERATED ALWAYS AS (CASE WHEN is_default = 1 THEN role ELSE NULL END) STORED,
  UNIQUE KEY uq_fonts_one_default_per_role (default_slot),
  CHECK (role IN ('text', 'emoji')),
  CHECK (format IN ('ttf', 'otf')),
  CHECK (is_default IN (0, 1)),
  CHECK (active IN (0, 1))
) ENGINE=InnoDB;

-- Coffee Game Satarkhan
-- MySQL/MariaDB compatibility fix for:
-- 20260714_production_otp_dynamic_cleanup.sql
--
-- Safe to run after a partial import.
-- This file does not use ALTER TABLE ... ADD COLUMN IF NOT EXISTS.

SET @schema_name := DATABASE();

-- ---------------------------------------------------------------------------
-- users.two_step_code_hash
-- ---------------------------------------------------------------------------
SELECT COUNT(*) INTO @column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'two_step_code_hash';

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `two_step_code_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- users.two_step_development_code
-- ---------------------------------------------------------------------------
SELECT COUNT(*) INTO @column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'two_step_development_code';

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `two_step_development_code` char(6) COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- users.two_step_expires_at
-- ---------------------------------------------------------------------------
SELECT COUNT(*) INTO @column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'two_step_expires_at';

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `two_step_expires_at` datetime DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- users.two_step_attempts
-- ---------------------------------------------------------------------------
SELECT COUNT(*) INTO @column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'two_step_attempts';

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `two_step_attempts` int NOT NULL DEFAULT 0',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- users.two_step_requested_at
-- ---------------------------------------------------------------------------
SELECT COUNT(*) INTO @column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME = 'two_step_requested_at';

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `users` ADD COLUMN `two_step_requested_at` datetime DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- otp_codes.user_id
-- ---------------------------------------------------------------------------
SELECT COUNT(*) INTO @column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'otp_codes'
  AND COLUMN_NAME = 'user_id';

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `otp_codes` ADD COLUMN `user_id` bigint UNSIGNED DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- otp_codes.request_ip
-- ---------------------------------------------------------------------------
SELECT COUNT(*) INTO @column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'otp_codes'
  AND COLUMN_NAME = 'request_ip';

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE `otp_codes` ADD COLUMN `request_ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- otp_codes indexes
-- ---------------------------------------------------------------------------
SELECT COUNT(*) INTO @index_exists
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'otp_codes'
  AND INDEX_NAME = 'idx_otp_user_created';

SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE `otp_codes` ADD INDEX `idx_otp_user_created` (`user_id`, `created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @index_exists
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'otp_codes'
  AND INDEX_NAME = 'idx_otp_ip_created';

SET @sql := IF(
  @index_exists = 0,
  'ALTER TABLE `otp_codes` ADD INDEX `idx_otp_ip_created` (`request_ip`, `created_at`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- Settings: safe after a partial import because INSERT IGNORE does not overwrite
-- existing rows.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `app_settings` (`key`, `value`, `is_public`, `updated_at`) VALUES
  ('club.profile', JSON_OBJECT('name', 'Coffee Game ستارخان', 'phone', '', 'address', ''), 1, NOW()),
  ('club.resources', JSON_OBJECT('ps5', 0, 'backgammonTables', 0), 1, NOW()),
  ('auth.settings', JSON_OBJECT('password', TRUE, 'sms', TRUE, 'google', FALSE, 'admin2fa', 'optional'), 0, NOW()),
  ('payment.settings', JSON_OBJECT('provider', 'manual_transfer', 'cash', TRUE, 'receipt', TRUE, 'partial', FALSE), 0, NOW()),
  ('notification.settings', JSON_OBJECT('sms', 'optional', 'email', FALSE, 'inApp', TRUE), 0, NOW());

UPDATE `app_settings`
SET `value` = JSON_SET(COALESCE(`value`, JSON_OBJECT()), '$.provider', 'manual_transfer'),
    `updated_at` = NOW()
WHERE `key` = 'payment.settings';

-- Remove expired readable local-development OTP values.
UPDATE `users`
SET `two_step_development_code` = NULL,
    `two_step_code_hash` = NULL,
    `two_step_expires_at` = NULL,
    `two_step_attempts` = 0
WHERE `two_step_expires_at` IS NOT NULL
  AND `two_step_expires_at` <= NOW();

-- ---------------------------------------------------------------------------
-- Verification
-- ---------------------------------------------------------------------------
SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'users'
  AND COLUMN_NAME IN (
    'two_step_code_hash',
    'two_step_development_code',
    'two_step_expires_at',
    'two_step_attempts',
    'two_step_requested_at'
  )
ORDER BY ORDINAL_POSITION;

SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'otp_codes'
  AND COLUMN_NAME IN ('user_id', 'request_ip')
ORDER BY ORDINAL_POSITION;

SELECT
  INDEX_NAME,
  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS index_columns
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = @schema_name
  AND TABLE_NAME = 'otp_codes'
  AND INDEX_NAME IN ('idx_otp_user_created', 'idx_otp_ip_created')
GROUP BY INDEX_NAME
ORDER BY INDEX_NAME;

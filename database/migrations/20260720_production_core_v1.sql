-- Coffee Game Satarkhan - Production Core v1
-- Compatible with MySQL 5.7+/8 and MariaDB versions that do not support ADD COLUMN IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `rate_limits` (
  `scope_key` char(64) NOT NULL,
  `attempts` int unsigned NOT NULL DEFAULT 0,
  `window_started_at` datetime NOT NULL,
  `updated_at` datetime NOT NULL,
  PRIMARY KEY (`scope_key`),
  KEY `idx_rate_limits_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `app_settings` (`key`,`value`,`is_public`,`updated_at`)
VALUES
('auth.settings', JSON_OBJECT('password',true,'sms',true,'google',false,'admin2fa','optional'), 0, NOW()),
('payment.settings', JSON_OBJECT('provider','manual_transfer','cash',true,'pos',true,'receipt',true,'partial',false), 0, NOW()),
('notification.settings', JSON_OBJECT('inApp',true,'email',false,'sms','optional'), 0, NOW())
ON DUPLICATE KEY UPDATE `key`=VALUES(`key`);

-- Ensure payment.settings has an explicit POS switch without overwriting other values.
UPDATE `app_settings`
SET `value`=JSON_SET(COALESCE(`value`, JSON_OBJECT()), '$.pos',
  COALESCE(JSON_EXTRACT(`value`, '$.pos'), true)
), `updated_at`=NOW()
WHERE `key`='payment.settings';

-- Public tracking must use the random token only. Keep tracking_code for display/support lookup.
UPDATE registrations
SET tracking_token=LOWER(REPLACE(UUID(),'-',''))
WHERE tracking_token IS NULL OR CHAR_LENGTH(tracking_token)<32;

-- Add a unique index only when it is missing.
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema=DATABASE() AND table_name='registrations' AND index_name='uq_registrations_tracking_token'
);
SET @sql := IF(@idx_exists=0,
  'ALTER TABLE registrations ADD UNIQUE KEY uq_registrations_tracking_token (tracking_token)',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Restrict core production permissions to explicit role mappings; super_admin keeps all permissions.
INSERT INTO permissions (`name`,`title`,`group_name`) VALUES
('players.view','مشاهده بازیکنان','users'),
('content.manage','مدیریت محتوا','content'),
('settings.manage','مدیریت تنظیمات','system'),
('templates.manage','مدیریت قالب مسابقه','tournaments')
ON DUPLICATE KEY UPDATE
  `title`=VALUES(`title`),
  `group_name`=VALUES(`group_name`);

INSERT IGNORE INTO role_permissions (`role_id`,`permission_id`)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.name='super_admin';

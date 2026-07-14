-- Coffee Game Satarkhan
-- Production OTP and dynamic-data migration
-- Import exactly once into the current database through phpMyAdmin.

START TRANSACTION;

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `two_step_code_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `two_factor_enabled`,
  ADD COLUMN IF NOT EXISTS `two_step_development_code` char(6) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `two_step_code_hash`,
  ADD COLUMN IF NOT EXISTS `two_step_expires_at` datetime DEFAULT NULL AFTER `two_step_development_code`,
  ADD COLUMN IF NOT EXISTS `two_step_attempts` int NOT NULL DEFAULT '0' AFTER `two_step_expires_at`,
  ADD COLUMN IF NOT EXISTS `two_step_requested_at` datetime DEFAULT NULL AFTER `two_step_attempts`;

ALTER TABLE `otp_codes`
  ADD COLUMN IF NOT EXISTS `user_id` bigint UNSIGNED DEFAULT NULL AFTER `id`,
  ADD COLUMN IF NOT EXISTS `request_ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `attempts`,
  ADD KEY `idx_otp_user_created` (`user_id`,`created_at`),
  ADD KEY `idx_otp_ip_created` (`request_ip`,`created_at`);

-- Insert missing settings without overwriting the current club information.
INSERT IGNORE INTO `app_settings` (`key`,`value`,`is_public`,`updated_at`) VALUES
  ('club.profile', JSON_OBJECT('name','Coffee Game ستارخان','phone','','address',''), 1, NOW()),
  ('club.resources', JSON_OBJECT('ps5',0,'backgammonTables',0), 1, NOW()),
  ('auth.settings', JSON_OBJECT('password',TRUE,'sms',TRUE,'google',FALSE,'admin2fa','optional'), 0, NOW()),
  ('payment.settings', JSON_OBJECT('provider','manual_transfer','cash',TRUE,'receipt',TRUE,'partial',FALSE), 0, NOW()),
  ('notification.settings', JSON_OBJECT('sms','optional','email',FALSE,'inApp',TRUE), 0, NOW());

-- Manual transfer / POS / cash is the active payment flow.
UPDATE `app_settings`
SET `value`=JSON_SET(COALESCE(`value`,JSON_OBJECT()),'$.provider','manual_transfer'),
    `updated_at`=NOW()
WHERE `key`='payment.settings';

-- Expired or consumed local-development OTP values must not remain readable.
UPDATE `users`
SET `two_step_development_code`=NULL,
    `two_step_code_hash`=NULL,
    `two_step_expires_at`=NULL,
    `two_step_attempts`=0
WHERE `two_step_expires_at` IS NOT NULL AND `two_step_expires_at`<=NOW();

COMMIT;

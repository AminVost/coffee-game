-- Coffee Game Satarkhan
-- Critical security and workflow patch migration
-- Safe to run more than once on the existing coffee_game_satarkhan database.

SET NAMES utf8mb4;
USE `coffee_game_satarkhan`;

START TRANSACTION;

-- Keep permission definitions available even on databases created from an older seed.
INSERT INTO `permissions` (`name`,`title`,`group_name`) VALUES
('tournaments.view','مشاهده مسابقات','tournaments'),
('tournaments.manage','مدیریت مسابقات','tournaments'),
('templates.manage','مدیریت قالب‌ها','tournaments'),
('draws.manage','مدیریت قرعه','matches'),
('matches.manage','مدیریت بازی‌ها','matches'),
('results.submit','ثبت نتیجه','matches'),
('payments.view','مشاهده پرداخت‌ها','payments'),
('payments.approve','تایید پرداخت','payments'),
('users.manage','مدیریت کاربران','users'),
('roles.manage','مدیریت نقش‌ها','users'),
('content.manage','مدیریت محتوا','content'),
('settings.manage','مدیریت تنظیمات','system'),
('audit.view','مشاهده تاریخچه','system'),
('checkin.manage','مدیریت حضور','registrations')
ON DUPLICATE KEY UPDATE
  `title`=VALUES(`title`),
  `group_name`=VALUES(`group_name`);

-- Super admin always receives every permission.
INSERT IGNORE INTO `role_permissions` (`role_id`,`permission_id`)
SELECT r.id,p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name='super_admin';

-- Restore the intended permission sets if an older database missed them.
INSERT IGNORE INTO `role_permissions` (`role_id`,`permission_id`)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE
  (r.name='manager' AND p.name IN (
    'tournaments.view','tournaments.manage','templates.manage','draws.manage',
    'matches.manage','results.submit','payments.view','payments.approve',
    'users.manage','content.manage','audit.view','checkin.manage'
  )) OR
  (r.name='operator' AND p.name IN (
    'tournaments.view','draws.manage','matches.manage','results.submit','checkin.manage'
  )) OR
  (r.name='referee' AND p.name IN ('tournaments.view','matches.manage','results.submit')) OR
  (r.name='cashier' AND p.name IN ('payments.view','payments.approve')) OR
  (r.name='content_manager' AND p.name='content.manage') OR
  (r.name='player' AND p.name='tournaments.view');

-- Operational defaults used by the new session and OTP flows.
INSERT INTO `app_settings` (`key`,`value`,`is_public`) VALUES
('security.sessionDays',JSON_OBJECT('value',7),0),
('security.smsOtp',JSON_OBJECT('ttlMinutes',5,'maxAttempts',5,'cooldownSeconds',60),0)
ON DUPLICATE KEY UPDATE `value`=VALUES(`value`),`is_public`=VALUES(`is_public`);

-- Old expired records are no longer useful and increase lookup cost.
DELETE FROM `sessions`
WHERE `expires_at` < DATE_SUB(NOW(),INTERVAL 7 DAY)
   OR (`revoked_at` IS NOT NULL AND `revoked_at` < DATE_SUB(NOW(),INTERVAL 7 DAY));

DELETE FROM `otp_codes`
WHERE `created_at` < DATE_SUB(NOW(),INTERVAL 2 DAY);

COMMIT;

-- Diagnostic only: the application now reuses and locks player identities by mobile.
-- Existing historical duplicates are deliberately not deleted automatically because
-- they may already own match/ranking/team history and require a reviewed merge.
SELECT `mobile`,COUNT(*) AS duplicate_count,GROUP_CONCAT(`id` ORDER BY (`user_id` IS NOT NULL) DESC,`id`) AS player_ids
FROM `players`
WHERE `mobile` IS NOT NULL AND `mobile`<>''
GROUP BY `mobile`
HAVING COUNT(*)>1;

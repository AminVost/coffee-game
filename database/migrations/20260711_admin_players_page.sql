-- Coffee Game Satarkhan
-- Admin players page permission
-- Safe to run more than once.

SET NAMES utf8mb4;
USE `coffee_game_satarkhan`;

START TRANSACTION;

INSERT INTO `permissions` (`name`,`title`,`group_name`) VALUES
('players.view','مشاهده بازیکنان','users')
ON DUPLICATE KEY UPDATE
  `title`=VALUES(`title`),
  `group_name`=VALUES(`group_name`);

-- Super admin must always have access to every permission.
INSERT IGNORE INTO `role_permissions` (`role_id`,`permission_id`)
SELECT r.id,p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name='super_admin';

-- Managers can inspect the complete player directory.
INSERT IGNORE INTO `role_permissions` (`role_id`,`permission_id`)
SELECT r.id,p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name='manager' AND p.name='players.view';

COMMIT;

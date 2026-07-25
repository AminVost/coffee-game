-- Coffee Game Satarkhan - Complete platform patch
-- Target: MySQL 8.0+
-- Run this file once before deploying the patched application.

SET NAMES utf8mb4;
SET @cgs_schema := DATABASE();

DELIMITER $$

DROP PROCEDURE IF EXISTS cgs_complete_patch_preflight$$
CREATE PROCEDURE cgs_complete_patch_preflight()
BEGIN
  IF EXISTS (
    SELECT 1 FROM registration_entries
    WHERE (player_id IS NULL AND team_id IS NULL) OR (player_id IS NOT NULL AND team_id IS NOT NULL)
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Preflight failed: invalid registration_entries player/team relation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM match_participants
    WHERE (player_id IS NULL AND team_id IS NULL) OR (player_id IS NOT NULL AND team_id IS NOT NULL)
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Preflight failed: invalid match_participants player/team relation';
  END IF;

  IF EXISTS (SELECT user_id FROM players WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*)>1 LIMIT 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Preflight failed: duplicate players.user_id';
  END IF;

  IF EXISTS (SELECT mobile FROM players WHERE NULLIF(TRIM(mobile),'') IS NOT NULL GROUP BY mobile HAVING COUNT(*)>1 LIMIT 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Preflight failed: duplicate players.mobile';
  END IF;

  IF EXISTS (SELECT registration_id FROM payments GROUP BY registration_id HAVING COUNT(*)>1 LIMIT 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Preflight failed: multiple payments for one registration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM otp_codes o
    LEFT JOIN users u ON u.id=o.user_id
    WHERE o.user_id IS NOT NULL AND u.id IS NULL
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Preflight failed: orphan otp_codes.user_id';
  END IF;

  IF EXISTS (
    SELECT match_id,submitted_by
    FROM match_disputes
    WHERE status='open' AND submitted_by IS NOT NULL
    GROUP BY match_id,submitted_by
    HAVING COUNT(*)>1
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Preflight failed: duplicate open match disputes';
  END IF;
END$$
CALL cgs_complete_patch_preflight()$$
DROP PROCEDURE cgs_complete_patch_preflight$$

DROP PROCEDURE IF EXISTS cgs_add_column$$
CREATE PROCEDURE cgs_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND COLUMN_NAME=p_column
  ) THEN
    SET @cgs_sql=CONCAT('ALTER TABLE `',p_table,'` ADD COLUMN `',p_column,'` ',p_definition);
    PREPARE cgs_stmt FROM @cgs_sql; EXECUTE cgs_stmt; DEALLOCATE PREPARE cgs_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS cgs_add_index$$
CREATE PROCEDURE cgs_add_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND INDEX_NAME=p_index
  ) THEN
    SET @cgs_sql=CONCAT('ALTER TABLE `',p_table,'` ADD ',p_definition);
    PREPARE cgs_stmt FROM @cgs_sql; EXECUTE cgs_stmt; DEALLOCATE PREPARE cgs_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS cgs_add_constraint$$
CREATE PROCEDURE cgs_add_constraint(IN p_table VARCHAR(64), IN p_constraint VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND CONSTRAINT_NAME=p_constraint
  ) THEN
    SET @cgs_sql=CONCAT('ALTER TABLE `',p_table,'` ADD CONSTRAINT `',p_constraint,'` ',p_definition);
    PREPARE cgs_stmt FROM @cgs_sql; EXECUTE cgs_stmt; DEALLOCATE PREPARE cgs_stmt;
  END IF;
END$$

DELIMITER ;

CREATE TABLE IF NOT EXISTS patch_complete_platform_20260723_backup (
  entity_type VARCHAR(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  entity_key VARCHAR(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  json_value JSON DEFAULT NULL,
  text_value VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  number_value BIGINT DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (entity_type,entity_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO patch_complete_platform_20260723_backup(entity_type,entity_key,json_value,number_value)
SELECT 'app_setting',`key`,value,is_public
FROM app_settings
WHERE `key` IN ('auth.settings','payment.settings','notification.settings','registration.settings','otp.settings');

INSERT IGNORE INTO patch_complete_platform_20260723_backup(entity_type,entity_key,text_value)
SELECT 'permission',name,title
FROM permissions
WHERE name IN ('templates.manage','content.manage','settings.manage','players.view');

CREATE TABLE IF NOT EXISTS admin_login_challenges (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  otp_id BIGINT UNSIGNED NOT NULL,
  ip_address VARCHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  user_agent VARCHAR(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  consumed_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_login_challenge_token (token_hash),
  KEY idx_admin_login_challenge_user (user_id,consumed_at,expires_at),
  KEY fk_admin_login_challenge_otp (otp_id),
  CONSTRAINT fk_admin_login_challenge_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_login_challenge_otp FOREIGN KEY (otp_id) REFERENCES otp_codes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS team_invitations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  team_id BIGINT UNSIGNED NOT NULL,
  invited_mobile VARCHAR(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  invited_player_id BIGINT UNSIGNED DEFAULT NULL,
  invited_by_user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  status ENUM('PENDING','ACCEPTED','REJECTED','EXPIRED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  expires_at DATETIME NOT NULL,
  responded_at DATETIME DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_team_invitation_public_id (public_id),
  UNIQUE KEY uq_team_invitation_team_mobile (team_id,invited_mobile),
  UNIQUE KEY uq_team_invitation_token (token_hash),
  KEY fk_team_invitation_player (invited_player_id),
  KEY fk_team_invitation_sender (invited_by_user_id),
  CONSTRAINT fk_team_invitation_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT fk_team_invitation_player FOREIGN KEY (invited_player_id) REFERENCES players(id) ON DELETE SET NULL,
  CONSTRAINT fk_team_invitation_sender FOREIGN KEY (invited_by_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tournament_participant_state (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tournament_id BIGINT UNSIGNED NOT NULL,
  player_id BIGINT UNSIGNED DEFAULT NULL,
  team_id BIGINT UNSIGNED DEFAULT NULL,
  losses INT NOT NULL DEFAULT 0,
  eliminated TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tournament_participant_state_player (tournament_id,player_id),
  UNIQUE KEY uq_tournament_participant_state_team (tournament_id,team_id),
  KEY fk_tournament_participant_state_player (player_id),
  KEY fk_tournament_participant_state_team (team_id),
  CONSTRAINT fk_tournament_participant_state_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_participant_state_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_participant_state_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  CONSTRAINT chk_tournament_participant_state_target CHECK ((player_id IS NULL) <> (team_id IS NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CALL cgs_add_column('tournament_matches','pair_key','VARCHAR(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER notes');
CALL cgs_add_column('tournament_matches','leg_number','TINYINT UNSIGNED NOT NULL DEFAULT 1 AFTER pair_key');
CALL cgs_add_index('tournament_matches','idx_matches_pair','KEY `idx_matches_pair` (`tournament_id`,`round_id`,`pair_key`,`leg_number`)');

CALL cgs_add_column('registration_holds','existing_team_id','BIGINT UNSIGNED DEFAULT NULL AFTER team_title');
CALL cgs_add_index('registration_holds','idx_registration_holds_existing_team','KEY `idx_registration_holds_existing_team` (`existing_team_id`)');
CALL cgs_add_constraint('registration_holds','fk_registration_holds_existing_team','FOREIGN KEY (`existing_team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL');

CALL cgs_add_column('waitlist_entries','public_id','CHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER id');
CALL cgs_add_column('waitlist_entries','user_id','BIGINT UNSIGNED DEFAULT NULL AFTER registration_id');
CALL cgs_add_column('waitlist_entries','tournament_id','BIGINT UNSIGNED DEFAULT NULL AFTER user_id');
CALL cgs_add_column('waitlist_entries','status','ENUM(''WAITING'',''OFFERED'',''CONVERTED'',''EXPIRED'',''DECLINED'',''CANCELLED'') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''WAITING'' AFTER position');
CALL cgs_add_column('waitlist_entries','participant_type','ENUM(''INDIVIDUAL'',''TEAM'') COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER status');
CALL cgs_add_column('waitlist_entries','player_data','JSON DEFAULT NULL AFTER participant_type');
CALL cgs_add_column('waitlist_entries','team_title','VARCHAR(140) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER player_data');
CALL cgs_add_column('waitlist_entries','existing_team_id','BIGINT UNSIGNED DEFAULT NULL AFTER team_title');
CALL cgs_add_column('waitlist_entries','slots','INT NOT NULL DEFAULT 1 AFTER existing_team_id');
CALL cgs_add_column('waitlist_entries','amount','BIGINT NOT NULL DEFAULT 0 AFTER slots');
CALL cgs_add_column('waitlist_entries','payment_method','VARCHAR(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT ''card_to_card'' AFTER amount');
CALL cgs_add_column('waitlist_entries','offer_token','CHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER payment_method');
CALL cgs_add_column('waitlist_entries','cancelled_at','DATETIME DEFAULT NULL AFTER accepted_at');
CALL cgs_add_column('waitlist_entries','converted_at','DATETIME DEFAULT NULL AFTER cancelled_at');
CALL cgs_add_column('waitlist_entries','created_at','DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER converted_at');
CALL cgs_add_column('waitlist_entries','updated_at','DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');

UPDATE waitlist_entries w
JOIN registrations r ON r.id=w.registration_id
JOIN tournaments t ON t.id=r.tournament_id
SET w.public_id=COALESCE(w.public_id,UUID()),
    w.user_id=COALESCE(w.user_id,r.buyer_user_id),
    w.tournament_id=COALESCE(w.tournament_id,r.tournament_id),
    w.participant_type=COALESCE(w.participant_type,t.participant_type),
    w.player_data=COALESCE(w.player_data,JSON_ARRAY()),
    w.slots=COALESCE(NULLIF(w.slots,0),r.slots),
    w.amount=COALESCE(NULLIF(w.amount,0),r.payable_amount),
    w.status=CASE WHEN w.accepted_at IS NOT NULL THEN 'CONVERTED' WHEN w.offered_at IS NOT NULL THEN 'OFFERED' ELSE w.status END,
    w.converted_at=COALESCE(w.converted_at,w.accepted_at)
WHERE w.registration_id IS NOT NULL;

UPDATE waitlist_entries SET public_id=UUID() WHERE public_id IS NULL;
ALTER TABLE waitlist_entries MODIFY registration_id BIGINT UNSIGNED NULL;
ALTER TABLE waitlist_entries MODIFY public_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL;
-- Legacy waitlist rows may belong to guest registrations without a buyer account.
-- New application-created rows always include user_id, but the column remains nullable for safe migration.
ALTER TABLE waitlist_entries MODIFY user_id BIGINT UNSIGNED NULL;
ALTER TABLE waitlist_entries MODIFY tournament_id BIGINT UNSIGNED NOT NULL;
ALTER TABLE waitlist_entries MODIFY participant_type ENUM('INDIVIDUAL','TEAM') COLLATE utf8mb4_unicode_ci NOT NULL;
ALTER TABLE waitlist_entries MODIFY player_data JSON NOT NULL;

DELIMITER $$
DROP PROCEDURE IF EXISTS cgs_waitlist_preflight$$
CREATE PROCEDURE cgs_waitlist_preflight()
BEGIN
  IF EXISTS (
    SELECT public_id
    FROM waitlist_entries
    GROUP BY public_id
    HAVING COUNT(*)>1
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Preflight failed: duplicate waitlist public_id';
  END IF;

  IF EXISTS (
    SELECT user_id,tournament_id
    FROM waitlist_entries
    WHERE user_id IS NOT NULL AND status IN ('WAITING','OFFERED')
    GROUP BY user_id,tournament_id
    HAVING COUNT(*)>1
    LIMIT 1
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Preflight failed: duplicate active waitlist entry';
  END IF;
END$$
CALL cgs_waitlist_preflight()$$
DROP PROCEDURE cgs_waitlist_preflight$$
DELIMITER ;

CALL cgs_add_column('waitlist_entries','active_guard','TINYINT GENERATED ALWAYS AS (CASE WHEN status IN (''WAITING'',''OFFERED'') THEN 1 ELSE NULL END) STORED');
CALL cgs_add_index('waitlist_entries','uq_waitlist_public_id','UNIQUE KEY `uq_waitlist_public_id` (`public_id`)');
CALL cgs_add_index('waitlist_entries','uq_waitlist_active_user','UNIQUE KEY `uq_waitlist_active_user` (`user_id`,`tournament_id`,`active_guard`)');
CALL cgs_add_index('waitlist_entries','idx_waitlist_queue','KEY `idx_waitlist_queue` (`tournament_id`,`status`,`position`,`id`)');
CALL cgs_add_index('waitlist_entries','idx_waitlist_offer_expiry','KEY `idx_waitlist_offer_expiry` (`status`,`offer_expires_at`)');
CALL cgs_add_index('waitlist_entries','idx_waitlist_existing_team','KEY `idx_waitlist_existing_team` (`existing_team_id`)');
CALL cgs_add_constraint('waitlist_entries','fk_waitlist_user','FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE');
CALL cgs_add_constraint('waitlist_entries','fk_waitlist_tournament','FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE');
CALL cgs_add_constraint('waitlist_entries','fk_waitlist_existing_team','FOREIGN KEY (`existing_team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL');

UPDATE players SET mobile=NULL WHERE TRIM(COALESCE(mobile,''))='';
CALL cgs_add_index('players','uq_players_user','UNIQUE KEY `uq_players_user` (`user_id`)');
CALL cgs_add_index('players','uq_players_mobile','UNIQUE KEY `uq_players_mobile` (`mobile`)');
CALL cgs_add_index('payments','uq_payments_registration','UNIQUE KEY `uq_payments_registration` (`registration_id`)');
CALL cgs_add_constraint('otp_codes','fk_otp_user','FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL');
CALL cgs_add_constraint('registration_entries','chk_registration_entry_target','CHECK ((`player_id` IS NULL) <> (`team_id` IS NULL))');
CALL cgs_add_constraint('match_participants','chk_match_participant_target','CHECK ((`player_id` IS NULL) <> (`team_id` IS NULL))');

CALL cgs_add_column('match_disputes','open_guard','TINYINT GENERATED ALWAYS AS (CASE WHEN status=''open'' THEN 1 ELSE NULL END) STORED');
CALL cgs_add_index('match_disputes','uq_open_match_dispute','UNIQUE KEY `uq_open_match_dispute` (`match_id`,`submitted_by`,`open_guard`)');

UPDATE permissions SET title='مدیریت قالب‌های مسابقه' WHERE name='templates.manage';
UPDATE permissions SET title='مدیریت محتوا' WHERE name='content.manage';
UPDATE permissions SET title='مدیریت تنظیمات' WHERE name='settings.manage';
UPDATE permissions SET title='مشاهده بازیکنان' WHERE name='players.view';

-- Preserve values from the legacy single-purpose settings while consolidating runtime settings.
SET @cgs_session_days := COALESCE(
  (SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(value,'$.value')) AS UNSIGNED) FROM app_settings WHERE `key`='security.sessionDays' LIMIT 1),
  7
);
SET @cgs_hold_minutes := COALESCE(
  (SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(value,'$.value')) AS UNSIGNED) FROM app_settings WHERE `key`='registration.holdMinutes' LIMIT 1),
  15
);
SET @cgs_correction_hours := COALESCE(
  (SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(value,'$.value')) AS UNSIGNED) FROM app_settings WHERE `key`='registration.correctionHours' LIMIT 1),
  24
);
SET @cgs_otp_ttl := COALESCE(
  (SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(value,'$.ttlMinutes')) AS UNSIGNED) FROM app_settings WHERE `key`='security.smsOtp' LIMIT 1),
  5
);
SET @cgs_otp_attempts := COALESCE(
  (SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(value,'$.maxAttempts')) AS UNSIGNED) FROM app_settings WHERE `key`='security.smsOtp' LIMIT 1),
  5
);
SET @cgs_otp_cooldown := COALESCE(
  (SELECT CAST(JSON_UNQUOTE(JSON_EXTRACT(value,'$.cooldownSeconds')) AS UNSIGNED) FROM app_settings WHERE `key`='security.smsOtp' LIMIT 1),
  60
);

INSERT INTO app_settings(`key`,`value`,`is_public`) VALUES
('auth.settings',JSON_OBJECT('sms',CAST('true' AS JSON),'google',CAST('false' AS JSON),'admin2fa','optional','password',CAST('true' AS JSON),'sessionDays',@cgs_session_days),0),
('payment.settings',JSON_OBJECT('pos',CAST('true' AS JSON),'cash',CAST('true' AS JSON),'partial',CAST('false' AS JSON),'receipt',CAST('true' AS JSON),'provider','manual_transfer'),0),
('notification.settings',JSON_OBJECT('sms','optional','email',CAST('false' AS JSON),'inApp',CAST('true' AS JSON)),0),
('registration.settings',JSON_OBJECT('holdMinutes',@cgs_hold_minutes,'correctionHours',@cgs_correction_hours,'waitlistOfferMinutes',30),0),
('otp.settings',JSON_OBJECT('ttlMinutes',@cgs_otp_ttl,'maxAttempts',@cgs_otp_attempts,'cooldownSeconds',@cgs_otp_cooldown,'hourlyLimit',5,'ipHourlyLimit',20),0)
ON DUPLICATE KEY UPDATE
  value=CASE `key`
    WHEN 'auth.settings' THEN JSON_SET(
      COALESCE(value,JSON_OBJECT()),
      '$.sessionDays',COALESCE(JSON_EXTRACT(value,'$.sessionDays'),@cgs_session_days),
      '$.admin2fa',COALESCE(JSON_EXTRACT(value,'$.admin2fa'),CAST('"optional"' AS JSON))
    )
    WHEN 'payment.settings' THEN JSON_SET(
      COALESCE(value,JSON_OBJECT()),
      '$.pos',IF(JSON_TYPE(JSON_EXTRACT(value,'$.pos'))='BOOLEAN',JSON_EXTRACT(value,'$.pos'),CAST('true' AS JSON)),
      '$.cash',IF(JSON_TYPE(JSON_EXTRACT(value,'$.cash'))='BOOLEAN',JSON_EXTRACT(value,'$.cash'),CAST('true' AS JSON)),
      '$.receipt',IF(JSON_TYPE(JSON_EXTRACT(value,'$.receipt'))='BOOLEAN',JSON_EXTRACT(value,'$.receipt'),CAST('true' AS JSON)),
      '$.partial',IF(JSON_TYPE(JSON_EXTRACT(value,'$.partial'))='BOOLEAN',JSON_EXTRACT(value,'$.partial'),CAST('false' AS JSON))
    )
    WHEN 'notification.settings' THEN JSON_SET(
      COALESCE(value,JSON_OBJECT()),
      '$.inApp',COALESCE(JSON_EXTRACT(value,'$.inApp'),CAST('true' AS JSON)),
      '$.email',COALESCE(JSON_EXTRACT(value,'$.email'),CAST('false' AS JSON)),
      '$.sms',COALESCE(JSON_EXTRACT(value,'$.sms'),CAST('"optional"' AS JSON))
    )
    ELSE VALUES(value)
  END,
  is_public=VALUES(is_public),
  updated_at=NOW();

DROP PROCEDURE cgs_add_constraint;
DROP PROCEDURE cgs_add_index;
DROP PROCEDURE cgs_add_column;

-- Patch marker
INSERT INTO app_settings(`key`,`value`,`is_public`) VALUES
('patch.complete_platform.20260723',JSON_OBJECT('appliedAt',UTC_TIMESTAMP(),'version',1),0)
ON DUPLICATE KEY UPDATE value=VALUES(value),updated_at=NOW();

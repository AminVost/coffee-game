-- Coffee Game Satarkhan - rollback for complete platform patch
-- Target: MySQL 8.0+
-- Warning: rollback deletes records created by the new waitlist/login/team-invitation engines.
SET NAMES utf8mb4;
SET @cgs_schema := DATABASE();

DELIMITER $$

DROP PROCEDURE IF EXISTS cgs_complete_patch_down_preflight$$
CREATE PROCEDURE cgs_complete_patch_down_preflight()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLES
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='patch_complete_platform_20260723_backup'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Rollback backup not found; patch is not applied or was already rolled back';
  END IF;
END$$
CALL cgs_complete_patch_down_preflight()$$
DROP PROCEDURE cgs_complete_patch_down_preflight$$

DROP PROCEDURE IF EXISTS cgs_drop_column$$
CREATE PROCEDURE cgs_drop_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64))
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND COLUMN_NAME=p_column
  ) THEN
    SET @cgs_sql=CONCAT('ALTER TABLE `',p_table,'` DROP COLUMN `',p_column,'`');
    PREPARE cgs_stmt FROM @cgs_sql; EXECUTE cgs_stmt; DEALLOCATE PREPARE cgs_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS cgs_drop_index$$
CREATE PROCEDURE cgs_drop_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64))
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND INDEX_NAME=p_index
  ) THEN
    SET @cgs_sql=CONCAT('ALTER TABLE `',p_table,'` DROP INDEX `',p_index,'`');
    PREPARE cgs_stmt FROM @cgs_sql; EXECUTE cgs_stmt; DEALLOCATE PREPARE cgs_stmt;
  END IF;
END$$

DROP PROCEDURE IF EXISTS cgs_drop_constraint$$
CREATE PROCEDURE cgs_drop_constraint(IN p_table VARCHAR(64), IN p_constraint VARCHAR(64), IN p_type VARCHAR(20))
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND CONSTRAINT_NAME=p_constraint
  ) THEN
    SET @cgs_sql=CONCAT(
      'ALTER TABLE `',p_table,'` DROP ',
      IF(p_type='FOREIGN KEY','FOREIGN KEY','CHECK'),
      ' `',p_constraint,'`'
    );
    PREPARE cgs_stmt FROM @cgs_sql; EXECUTE cgs_stmt; DEALLOCATE PREPARE cgs_stmt;
  END IF;
END$$

DELIMITER ;

SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS tournament_participant_state;
DROP TABLE IF EXISTS team_invitations;
DROP TABLE IF EXISTS admin_login_challenges;

CALL cgs_drop_index('tournament_matches','idx_matches_pair');
CALL cgs_drop_column('tournament_matches','leg_number');
CALL cgs_drop_column('tournament_matches','pair_key');

CALL cgs_drop_constraint('registration_holds','fk_registration_holds_existing_team','FOREIGN KEY');
CALL cgs_drop_index('registration_holds','idx_registration_holds_existing_team');
CALL cgs_drop_column('registration_holds','existing_team_id');

CALL cgs_drop_index('match_disputes','uq_open_match_dispute');
CALL cgs_drop_column('match_disputes','open_guard');

CALL cgs_drop_constraint('waitlist_entries','fk_waitlist_user','FOREIGN KEY');
CALL cgs_drop_constraint('waitlist_entries','fk_waitlist_tournament','FOREIGN KEY');
CALL cgs_drop_constraint('waitlist_entries','fk_waitlist_existing_team','FOREIGN KEY');
CALL cgs_drop_index('waitlist_entries','uq_waitlist_public_id');
CALL cgs_drop_index('waitlist_entries','uq_waitlist_active_user');
CALL cgs_drop_index('waitlist_entries','idx_waitlist_queue');
CALL cgs_drop_index('waitlist_entries','idx_waitlist_offer_expiry');
CALL cgs_drop_index('waitlist_entries','idx_waitlist_existing_team');
CALL cgs_drop_column('waitlist_entries','active_guard');

-- Rows created by the new engine have no legacy registration_id and cannot be represented by the old schema.
DELETE FROM waitlist_entries WHERE registration_id IS NULL;

CALL cgs_drop_column('waitlist_entries','updated_at');
CALL cgs_drop_column('waitlist_entries','created_at');
CALL cgs_drop_column('waitlist_entries','converted_at');
CALL cgs_drop_column('waitlist_entries','cancelled_at');
CALL cgs_drop_column('waitlist_entries','offer_token');
CALL cgs_drop_column('waitlist_entries','payment_method');
CALL cgs_drop_column('waitlist_entries','amount');
CALL cgs_drop_column('waitlist_entries','slots');
CALL cgs_drop_column('waitlist_entries','existing_team_id');
CALL cgs_drop_column('waitlist_entries','team_title');
CALL cgs_drop_column('waitlist_entries','player_data');
CALL cgs_drop_column('waitlist_entries','participant_type');
CALL cgs_drop_column('waitlist_entries','status');
CALL cgs_drop_column('waitlist_entries','tournament_id');
CALL cgs_drop_column('waitlist_entries','user_id');
CALL cgs_drop_column('waitlist_entries','public_id');
ALTER TABLE waitlist_entries MODIFY registration_id BIGINT UNSIGNED NOT NULL;

CALL cgs_drop_index('players','uq_players_user');
CALL cgs_drop_index('players','uq_players_mobile');
CALL cgs_drop_index('payments','uq_payments_registration');
CALL cgs_drop_constraint('otp_codes','fk_otp_user','FOREIGN KEY');
CALL cgs_drop_constraint('registration_entries','chk_registration_entry_target','CHECK');
CALL cgs_drop_constraint('match_participants','chk_match_participant_target','CHECK');

-- Restore application settings and permission labels captured before applying the patch.
DELETE FROM app_settings WHERE `key` IN (
  'auth.settings',
  'payment.settings',
  'notification.settings',
  'registration.settings',
  'otp.settings',
  'patch.complete_platform.20260723'
);

INSERT INTO app_settings(`key`,value,is_public,updated_at)
SELECT entity_key,json_value,COALESCE(number_value,0),NOW()
FROM patch_complete_platform_20260723_backup
WHERE entity_type='app_setting';

UPDATE permissions p
JOIN patch_complete_platform_20260723_backup b
  ON b.entity_type='permission' AND b.entity_key=p.name
SET p.title=b.text_value;

DROP TABLE IF EXISTS patch_complete_platform_20260723_backup;

DROP PROCEDURE cgs_drop_constraint;
DROP PROCEDURE cgs_drop_index;
DROP PROCEDURE cgs_drop_column;

SET FOREIGN_KEY_CHECKS=1;

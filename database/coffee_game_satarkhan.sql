-- Coffee Game Satarkhan - MySQL 8 / MariaDB compatible schema
-- Import with phpMyAdmin. Default charset supports Persian and emoji.
SET NAMES utf8mb4;
SET time_zone = '+03:30';
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `coffee_game_satarkhan`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `coffee_game_satarkhan`;

DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `tournament_sponsors`;
DROP TABLE IF EXISTS `sponsors`;
DROP TABLE IF EXISTS `gallery_items`;
DROP TABLE IF EXISTS `announcements`;
DROP TABLE IF EXISTS `page_contents`;
DROP TABLE IF EXISTS `ranking_entries`;
DROP TABLE IF EXISTS `ranking_boards`;
DROP TABLE IF EXISTS `match_disputes`;
DROP TABLE IF EXISTS `match_participants`;
DROP TABLE IF EXISTS `tournament_matches`;
DROP TABLE IF EXISTS `tournament_rounds`;
DROP TABLE IF EXISTS `discount_usages`;
DROP TABLE IF EXISTS `discounts`;
DROP TABLE IF EXISTS `payment_receipts`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `waitlist_entries`;
DROP TABLE IF EXISTS `registration_entries`;
DROP TABLE IF EXISTS `registrations`;
DROP TABLE IF EXISTS `team_members`;
DROP TABLE IF EXISTS `teams`;
DROP TABLE IF EXISTS `tournaments`;
DROP TABLE IF EXISTS `tournament_templates`;
DROP TABLE IF EXISTS `resources`;
DROP TABLE IF EXISTS `venues`;
DROP TABLE IF EXISTS `games`;
DROP TABLE IF EXISTS `players`;
DROP TABLE IF EXISTS `otp_codes`;
DROP TABLE IF EXISTS `sessions`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `user_roles`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `app_settings`;

CREATE TABLE `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `mobile` VARCHAR(20) NULL,
  `email` VARCHAR(190) NULL,
  `password_hash` VARCHAR(255) NULL,
  `avatar_url` VARCHAR(500) NULL,
  `nickname` VARCHAR(80) NULL,
  `status` ENUM('ACTIVE','PENDING','SUSPENDED','DELETED') NOT NULL DEFAULT 'ACTIVE',
  `mobile_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `email_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `two_factor_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `deleted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_users_public_id` (`public_id`),
  UNIQUE KEY `uq_users_mobile` (`mobile`), UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_status` (`status`,`deleted_at`)
) ENGINE=InnoDB;

CREATE TABLE `roles` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(80) NOT NULL, `title` VARCHAR(120) NOT NULL,
  `description` VARCHAR(500) NULL, `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_roles_name` (`name`)
) ENGINE=InnoDB;

CREATE TABLE `permissions` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(120) NOT NULL, `title` VARCHAR(160) NOT NULL,
  `group_name` VARCHAR(80) NOT NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_permissions_name` (`name`)
) ENGINE=InnoDB;

CREATE TABLE `user_roles` (
  `user_id` BIGINT UNSIGNED NOT NULL, `role_id` INT UNSIGNED NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`),
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `role_permissions` (
  `role_id` INT UNSIGNED NOT NULL, `permission_id` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `token_hash` VARCHAR(255) NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL, `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(500) NULL, `expires_at` DATETIME NOT NULL,
  `revoked_at` DATETIME NULL, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_sessions_token` (`token_hash`),
  KEY `idx_sessions_user_expiry` (`user_id`,`expires_at`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `otp_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `destination` VARCHAR(190) NOT NULL,
  `purpose` VARCHAR(50) NOT NULL, `code_hash` VARCHAR(255) NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0, `expires_at` DATETIME NOT NULL,
  `consumed_at` DATETIME NULL, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_otp_destination` (`destination`,`purpose`,`expires_at`)
) ENGINE=InnoDB;

CREATE TABLE `players` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `user_id` BIGINT UNSIGNED NULL,
  `name` VARCHAR(120) NOT NULL, `mobile` VARCHAR(20) NULL,
  `avatar_url` VARCHAR(500) NULL, `is_guest` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_players_mobile` (`mobile`), KEY `idx_players_user` (`user_id`),
  CONSTRAINT `fk_players_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `games` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `slug` VARCHAR(80) NOT NULL,
  `title` VARCHAR(120) NOT NULL, `description` TEXT NULL, `icon` VARCHAR(80) NULL,
  `result_schema` JSON NULL, `settings_schema` JSON NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_games_slug` (`slug`)
) ENGINE=InnoDB;

CREATE TABLE `venues` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `title` VARCHAR(160) NOT NULL,
  `type` VARCHAR(40) NOT NULL DEFAULT 'internal', `address` VARCHAR(500) NULL,
  `map_url` VARCHAR(500) NULL, `phone` VARCHAR(30) NULL, `directions` TEXT NULL,
  `image_url` VARCHAR(500) NULL, `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `resources` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `venue_id` INT UNSIGNED NOT NULL,
  `code` VARCHAR(50) NOT NULL, `title` VARCHAR(120) NOT NULL, `type` VARCHAR(50) NOT NULL,
  `status` VARCHAR(40) NOT NULL DEFAULT 'available', `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `metadata` JSON NULL, PRIMARY KEY (`id`), UNIQUE KEY `uq_resources_code` (`code`),
  KEY `idx_resources_venue_type` (`venue_id`,`type`,`is_active`),
  CONSTRAINT `fk_resources_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `tournament_templates` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `game_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(160) NOT NULL, `description` VARCHAR(500) NULL,
  `configuration` JSON NOT NULL, `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` BIGINT UNSIGNED NULL, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_templates_game` (`game_id`,`is_active`),
  CONSTRAINT `fk_templates_game` FOREIGN KEY (`game_id`) REFERENCES `games` (`id`),
  CONSTRAINT `fk_templates_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `tournaments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `public_id` CHAR(36) NOT NULL,
  `slug` VARCHAR(180) NOT NULL, `title` VARCHAR(200) NOT NULL, `subtitle` VARCHAR(255) NULL,
  `description` TEXT NULL, `game_id` INT UNSIGNED NOT NULL,
  `template_id` BIGINT UNSIGNED NULL, `venue_id` INT UNSIGNED NULL,
  `format` VARCHAR(60) NOT NULL, `participant_type` ENUM('INDIVIDUAL','TEAM') NOT NULL DEFAULT 'INDIVIDUAL',
  `team_size` INT NOT NULL DEFAULT 1, `capacity` INT NOT NULL, `min_participants` INT NOT NULL DEFAULT 2,
  `price` BIGINT NOT NULL DEFAULT 0, `currency` VARCHAR(10) NOT NULL DEFAULT 'TOMAN',
  `status` ENUM('DRAFT','PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','DRAW_READY','RUNNING','COMPLETED','POSTPONED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `registration_starts_at` DATETIME NULL, `registration_ends_at` DATETIME NULL,
  `starts_at` DATETIME NOT NULL, `ends_at` DATETIME NULL,
  `reservation_expires_min` INT NOT NULL DEFAULT 30, `late_tolerance_min` INT NOT NULL DEFAULT 10,
  `waitlist_mode` VARCHAR(30) NOT NULL DEFAULT 'offer', `allow_multi_slot` TINYINT(1) NOT NULL DEFAULT 0,
  `has_third_place` TINYINT(1) NOT NULL DEFAULT 0, `draw_mode` VARCHAR(30) NOT NULL DEFAULT 'random',
  `rules` JSON NULL, `game_settings` JSON NULL, `scoring_settings` JSON NULL,
  `notification_settings` JSON NULL, `cancellation_settings` JSON NULL, `prize_settings` JSON NULL,
  `cover_image_url` VARCHAR(500) NULL, `is_featured` TINYINT(1) NOT NULL DEFAULT 0,
  `published_at` DATETIME NULL, `deleted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_tournaments_public_id` (`public_id`), UNIQUE KEY `uq_tournaments_slug` (`slug`),
  KEY `idx_tournaments_game_status_date` (`game_id`,`status`,`starts_at`),
  CONSTRAINT `fk_tournaments_game` FOREIGN KEY (`game_id`) REFERENCES `games` (`id`),
  CONSTRAINT `fk_tournaments_template` FOREIGN KEY (`template_id`) REFERENCES `tournament_templates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tournaments_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `teams` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `public_id` CHAR(36) NOT NULL,
  `title` VARCHAR(140) NOT NULL, `avatar_url` VARCHAR(500) NULL,
  `created_by_id` BIGINT UNSIGNED NULL, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_teams_public_id` (`public_id`),
  CONSTRAINT `fk_teams_creator` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `team_members` (
  `team_id` BIGINT UNSIGNED NOT NULL, `player_id` BIGINT UNSIGNED NOT NULL,
  `is_captain` TINYINT(1) NOT NULL DEFAULT 0, `joined_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`team_id`,`player_id`),
  CONSTRAINT `fk_team_members_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_team_members_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `registrations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `public_id` CHAR(36) NOT NULL,
  `tournament_id` BIGINT UNSIGNED NOT NULL, `buyer_user_id` BIGINT UNSIGNED NULL,
  `status` ENUM('RESERVED','PENDING_PAYMENT','PENDING_APPROVAL','CONFIRMED','WAITLISTED','CHECKED_IN','NO_SHOW','CANCELLED','REJECTED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  `slots` INT NOT NULL DEFAULT 1, `subtotal` BIGINT NOT NULL, `discount_amount` BIGINT NOT NULL DEFAULT 0,
  `payable_amount` BIGINT NOT NULL, `invite_code` VARCHAR(50) NULL, `qr_token` VARCHAR(120) NOT NULL,
  `reserved_until` DATETIME NULL, `checked_in_at` DATETIME NULL, `no_show_at` DATETIME NULL,
  `notes` VARCHAR(1000) NULL, `deleted_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_registrations_public_id` (`public_id`), UNIQUE KEY `uq_registrations_qr` (`qr_token`),
  KEY `idx_registrations_tournament_status` (`tournament_id`,`status`,`created_at`),
  CONSTRAINT `fk_registrations_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_registrations_buyer` FOREIGN KEY (`buyer_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `registration_entries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `registration_id` BIGINT UNSIGNED NOT NULL,
  `player_id` BIGINT UNSIGNED NULL, `team_id` BIGINT UNSIGNED NULL, `seed` INT NULL,
  `confirmed_at` DATETIME NULL, PRIMARY KEY (`id`), KEY `idx_entries_registration` (`registration_id`),
  CONSTRAINT `fk_entries_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_entries_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_entries_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `waitlist_entries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `registration_id` BIGINT UNSIGNED NOT NULL,
  `position` INT NOT NULL, `offered_at` DATETIME NULL, `offer_expires_at` DATETIME NULL,
  `accepted_at` DATETIME NULL, PRIMARY KEY (`id`), UNIQUE KEY `uq_waitlist_registration` (`registration_id`),
  CONSTRAINT `fk_waitlist_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `public_id` CHAR(36) NOT NULL,
  `user_id` BIGINT UNSIGNED NULL, `registration_id` BIGINT UNSIGNED NOT NULL,
  `method` VARCHAR(40) NOT NULL, `provider` VARCHAR(60) NULL, `amount` BIGINT NOT NULL,
  `status` ENUM('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `tracking_code` VARCHAR(120) NULL, `provider_payload` JSON NULL,
  `approved_by` BIGINT UNSIGNED NULL, `approved_at` DATETIME NULL, `rejected_reason` VARCHAR(500) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_payments_public_id` (`public_id`),
  KEY `idx_payments_registration_status` (`registration_id`,`status`),
  CONSTRAINT `fk_payments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payments_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `payment_receipts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `payment_id` BIGINT UNSIGNED NOT NULL,
  `file_path` VARCHAR(500) NOT NULL, `mime_type` VARCHAR(100) NOT NULL,
  `file_size` INT NOT NULL, `uploaded_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_receipts_payment` (`payment_id`),
  CONSTRAINT `fk_receipts_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `discounts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `tournament_id` BIGINT UNSIGNED NULL,
  `code` VARCHAR(60) NOT NULL, `type` VARCHAR(20) NOT NULL, `value` BIGINT NOT NULL,
  `max_discount` BIGINT NULL, `usage_limit` INT NULL, `per_user_limit` INT NOT NULL DEFAULT 1,
  `starts_at` DATETIME NULL, `expires_at` DATETIME NULL, `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_discounts_code` (`code`),
  CONSTRAINT `fk_discounts_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `discount_usages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `discount_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NULL, `payment_id` BIGINT UNSIGNED NULL, `amount` BIGINT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  KEY `idx_discount_usages` (`discount_id`,`user_id`),
  CONSTRAINT `fk_discount_usages_discount` FOREIGN KEY (`discount_id`) REFERENCES `discounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_discount_usages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_discount_usages_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `tournament_rounds` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `tournament_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(120) NOT NULL, `round_number` INT NOT NULL, `stage` VARCHAR(50) NOT NULL,
  `starts_at` DATETIME NULL, `configuration` JSON NULL, PRIMARY KEY (`id`),
  UNIQUE KEY `uq_round` (`tournament_id`,`round_number`,`stage`),
  CONSTRAINT `fk_rounds_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `tournament_matches` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `public_id` CHAR(36) NOT NULL,
  `tournament_id` BIGINT UNSIGNED NOT NULL, `round_id` BIGINT UNSIGNED NULL, `resource_id` INT UNSIGNED NULL,
  `match_number` INT NOT NULL, `status` ENUM('PENDING','READY','LIVE','COMPLETED','POSTPONED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `scheduled_at` DATETIME NULL, `started_at` DATETIME NULL, `completed_at` DATETIME NULL,
  `duration_min` INT NULL, `home_score` INT NULL, `away_score` INT NULL, `result_data` JSON NULL,
  `winner_slot` INT NULL, `referee_user_id` BIGINT UNSIGNED NULL, `notes` VARCHAR(1000) NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_matches_public_id` (`public_id`),
  UNIQUE KEY `uq_match_number` (`tournament_id`,`match_number`),
  KEY `idx_matches_status_date` (`tournament_id`,`status`,`scheduled_at`),
  CONSTRAINT `fk_matches_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_matches_round` FOREIGN KEY (`round_id`) REFERENCES `tournament_rounds` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_matches_resource` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_matches_referee` FOREIGN KEY (`referee_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `match_participants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `match_id` BIGINT UNSIGNED NOT NULL,
  `slot` INT NOT NULL, `player_id` BIGINT UNSIGNED NULL, `team_id` BIGINT UNSIGNED NULL,
  `seed` INT NULL, `is_winner` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_match_slot` (`match_id`,`slot`),
  CONSTRAINT `fk_match_participants_match` FOREIGN KEY (`match_id`) REFERENCES `tournament_matches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_match_participants_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_match_participants_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `match_disputes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `match_id` BIGINT UNSIGNED NOT NULL,
  `submitted_by` BIGINT UNSIGNED NULL, `reason` TEXT NOT NULL, `status` VARCHAR(30) NOT NULL DEFAULT 'open',
  `resolution` TEXT NULL, `resolved_by` BIGINT UNSIGNED NULL, `resolved_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`),
  CONSTRAINT `fk_disputes_match` FOREIGN KEY (`match_id`) REFERENCES `tournament_matches` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_disputes_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_disputes_resolver` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `ranking_boards` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `game_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(140) NOT NULL, `period_type` VARCHAR(30) NOT NULL,
  `period_key` VARCHAR(40) NOT NULL, `formula` JSON NOT NULL, `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_ranking_board` (`game_id`,`period_type`,`period_key`),
  CONSTRAINT `fk_ranking_boards_game` FOREIGN KEY (`game_id`) REFERENCES `games` (`id`)
) ENGINE=InnoDB;

CREATE TABLE `ranking_entries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `board_id` BIGINT UNSIGNED NOT NULL,
  `player_id` BIGINT UNSIGNED NOT NULL, `points` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `wins` INT NOT NULL DEFAULT 0, `draws` INT NOT NULL DEFAULT 0, `losses` INT NOT NULL DEFAULT 0,
  `played` INT NOT NULL DEFAULT 0, `scored` INT NOT NULL DEFAULT 0, `conceded` INT NOT NULL DEFAULT 0,
  `adjustment` DECIMAL(12,2) NOT NULL DEFAULT 0, `metadata` JSON NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_ranking_entry` (`board_id`,`player_id`),
  CONSTRAINT `fk_ranking_entries_board` FOREIGN KEY (`board_id`) REFERENCES `ranking_boards` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ranking_entries_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `page_contents` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `slug` VARCHAR(80) NOT NULL,
  `title` VARCHAR(160) NOT NULL, `body` LONGTEXT NOT NULL,
  `seo_title` VARCHAR(190) NULL, `seo_description` VARCHAR(500) NULL,
  `is_published` TINYINT(1) NOT NULL DEFAULT 1,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_page_contents_slug` (`slug`)
) ENGINE=InnoDB;

CREATE TABLE `announcements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `slug` VARCHAR(180) NOT NULL,
  `title` VARCHAR(200) NOT NULL, `excerpt` VARCHAR(500) NULL, `body` LONGTEXT NOT NULL,
  `image_url` VARCHAR(500) NULL, `is_published` TINYINT(1) NOT NULL DEFAULT 0,
  `published_at` DATETIME NULL, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_announcements_slug` (`slug`)
) ENGINE=InnoDB;

CREATE TABLE `gallery_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `title` VARCHAR(160) NULL,
  `image_url` VARCHAR(500) NOT NULL, `category` VARCHAR(80) NULL,
  `sort_order` INT NOT NULL DEFAULT 0, `is_published` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `sponsors` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `title` VARCHAR(160) NOT NULL,
  `logo_url` VARCHAR(500) NULL, `website_url` VARCHAR(500) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1, PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE `tournament_sponsors` (
  `tournament_id` BIGINT UNSIGNED NOT NULL, `sponsor_id` BIGINT UNSIGNED NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0, PRIMARY KEY (`tournament_id`,`sponsor_id`),
  CONSTRAINT `fk_tournament_sponsors_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tournament_sponsors_sponsor` FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `user_id` BIGINT UNSIGNED NOT NULL,
  `type` VARCHAR(60) NOT NULL, `title` VARCHAR(180) NOT NULL, `body` VARCHAR(1000) NOT NULL,
  `data` JSON NULL, `read_at` DATETIME NULL, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_notifications_user_read` (`user_id`,`read_at`,`created_at`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `actor_user_id` BIGINT UNSIGNED NULL,
  `action` VARCHAR(120) NOT NULL, `entity_type` VARCHAR(80) NOT NULL, `entity_id` VARCHAR(80) NULL,
  `old_data` JSON NULL, `new_data` JSON NULL, `ip_address` VARCHAR(64) NULL,
  `user_agent` VARCHAR(500) NULL, `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `idx_audit_created` (`created_at`), KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE `app_settings` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT, `key` VARCHAR(120) NOT NULL,
  `value` JSON NOT NULL, `is_public` TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `uq_app_settings_key` (`key`)
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
SET NAMES utf8mb4;
USE `coffee_game_satarkhan`;
SET FOREIGN_KEY_CHECKS = 0;

INSERT INTO `roles` (`id`,`name`,`title`,`description`,`is_system`) VALUES
(1,'super_admin','مدیر اصلی','دسترسی کامل به سیستم',1),(2,'manager','مدیر','مدیریت مسابقات و کاربران',1),
(3,'operator','اپراتور مسابقه','قرعه، زمان‌بندی و شرکت‌کنندگان',1),(4,'referee','داور','ثبت نتایج مسابقات تخصیص‌یافته',1),
(5,'cashier','صندوق‌دار','مدیریت پرداخت حضوری و فیش',1),(6,'content_manager','مدیر محتوا','مدیریت صفحات، اخبار و گالری',1),
(7,'player','بازیکن','کاربر ثبت‌نام‌شده',1),(8,'guest','مهمان','شرکت‌کننده مهمان',1);

INSERT INTO `permissions` (`id`,`name`,`title`,`group_name`) VALUES
(1,'tournaments.view','مشاهده مسابقات','tournaments'),(2,'tournaments.manage','مدیریت مسابقات','tournaments'),
(3,'templates.manage','مدیریت قالب‌ها','tournaments'),(4,'draws.manage','مدیریت قرعه','matches'),
(5,'matches.manage','مدیریت بازی‌ها','matches'),(6,'results.submit','ثبت نتیجه','matches'),
(7,'payments.view','مشاهده پرداخت‌ها','payments'),(8,'payments.approve','تایید پرداخت','payments'),
(9,'users.manage','مدیریت کاربران','users'),(10,'roles.manage','مدیریت نقش‌ها','users'),
(11,'content.manage','مدیریت محتوا','content'),(12,'settings.manage','مدیریت تنظیمات','system'),
(13,'audit.view','مشاهده تاریخچه','system'),(14,'checkin.manage','مدیریت حضور','registrations'),
(15,'players.view','مشاهده بازیکنان','users');
INSERT INTO `role_permissions` (`role_id`,`permission_id`) SELECT 1,id FROM permissions;
INSERT INTO `role_permissions` VALUES (2,1),(2,2),(2,3),(2,4),(2,5),(2,6),(2,7),(2,8),(2,9),(2,11),(2,13),(2,14),(2,15),(3,1),(3,4),(3,5),(3,6),(3,14),(4,1),(4,5),(4,6),(5,7),(5,8),(6,11),(7,1);

INSERT INTO `users` (`id`,`public_id`,`name`,`mobile`,`email`,`password_hash`,`status`,`mobile_verified`,`email_verified`) VALUES
(1,UUID(),'مدیر اصلی','09120000001','admin@coffeegame.local','$2b$12$M/3kvyCjUxVozqZjGzp9Aup7yl7OJ2QWHjJ0CvrX6LbB60CIf0JJK','ACTIVE',1,1),
(2,UUID(),'بازیکن آزمایشی','09120000002','player@coffeegame.local','$2b$12$cIaF2jZbXiVNpqSnKoVQI.GDmaWsPfiKnNZ9Vewq7jmZemBTwdDwq','ACTIVE',1,1);
INSERT INTO `user_roles` (`user_id`,`role_id`) VALUES (1,1),(2,7);
INSERT INTO `players` (`id`,`user_id`,`name`,`mobile`,`is_guest`) VALUES
(1,2,'بازیکن آزمایشی','09120000002',0),(2,NULL,'امیرحسین رضایی','09121111111',1),(3,NULL,'مهدی کریمی','09122222222',1),
(4,NULL,'کیان فرهمند','09123333333',1),(5,NULL,'فرهاد کاظمی','09124444444',1),(6,NULL,'بابک احمدی','09125555555',1);

INSERT INTO `games` (`id`,`slug`,`title`,`description`,`icon`,`result_schema`,`settings_schema`) VALUES
(1,'fc26','FC 26 روی PS5','مسابقات فوتبال کنسولی انفرادی و تیمی','Gamepad2',JSON_OBJECT('homeScore','number','awayScore','number'),JSON_OBJECT('halfMinutes',6,'extraTime',true,'penalties',true)),
(2,'backgammon','تخته‌نرد','مسابقات استاندارد امتیازی تخته‌نرد','Dices',JSON_OBJECT('homeScore','number','awayScore','number'),JSON_OBJECT('targetPoints',7,'doublingCube',false,'mars',true));

INSERT INTO `venues` (`id`,`title`,`type`,`address`,`phone`,`directions`,`is_active`) VALUES
(1,'Coffee Game ستارخان','internal','تهران، ستارخان - آدرس دقیق را از پنل ویرایش کنید','02100000000','لوکیشن نقشه را از پنل تنظیم کنید',1),
(2,'سالن رویداد آریا','external','تهران - آدرس نمونه',NULL,'اطلاعات نمونه برای مسابقه خارج مجموعه',1);

INSERT INTO `resources` (`venue_id`,`code`,`title`,`type`) VALUES
(1,'PS5-01','PS5 شماره ۱','ps5'),(1,'PS5-02','PS5 شماره ۲','ps5'),(1,'PS5-03','PS5 شماره ۳','ps5'),(1,'PS5-04','PS5 شماره ۴','ps5'),(1,'PS5-05','PS5 شماره ۵','ps5'),
(1,'PS5-06','PS5 شماره ۶','ps5'),(1,'PS5-07','PS5 شماره ۷','ps5'),(1,'PS5-08','PS5 شماره ۸','ps5'),(1,'PS5-09','PS5 شماره ۹','ps5'),(1,'PS5-10','PS5 شماره ۱۰','ps5'),
(1,'BG-01','میز تخته‌نرد ۱','backgammon_table'),(1,'BG-02','میز تخته‌نرد ۲','backgammon_table'),(1,'BG-03','میز تخته‌نرد ۳','backgammon_table'),(1,'BG-04','میز تخته‌نرد ۴','backgammon_table'),(1,'BG-05','میز تخته‌نرد ۵','backgammon_table');

INSERT INTO `tournament_templates` (`id`,`game_id`,`title`,`description`,`configuration`,`created_by`) VALUES
(1,1,'جام هفتگی FC 26','قالب حذفی ۳۲ نفره',JSON_OBJECT('format','single_elimination','capacity',32,'teamSize',1,'halfMinutes',6,'drawMode','random','lateToleranceMin',10),1),
(2,2,'تخته‌نرد هفت‌امتیازی','قالب گروهی و حذفی',JSON_OBJECT('format','groups_knockout','capacity',40,'targetPoints',7,'drawMode','seeded','lateToleranceMin',10),1),
(3,1,'لیگ تیمی 2vs2','قالب لیگ دوره‌ای تیمی',JSON_OBJECT('format','round_robin','capacity',16,'teamSize',2,'winPoints',3,'drawPoints',1),1);

INSERT INTO `tournaments` (`id`,`public_id`,`slug`,`title`,`description`,`game_id`,`template_id`,`venue_id`,`format`,`participant_type`,`team_size`,`capacity`,`min_participants`,`price`,`status`,`registration_starts_at`,`registration_ends_at`,`starts_at`,`reservation_expires_min`,`late_tolerance_min`,`waitlist_mode`,`allow_multi_slot`,`has_third_place`,`draw_mode`,`rules`,`game_settings`,`scoring_settings`,`prize_settings`,`cover_image_url`,`is_featured`,`published_at`) VALUES
(1,UUID(),'fc26-friday-cup-01','جام جمعه FC 26','جام سریع FC 26 با قرعه‌کشی زنده و زمان‌بندی خودکار.',1,1,1,'حذفی تک‌بازی','INDIVIDUAL',1,32,8,350000,'REGISTRATION_OPEN',NOW(),DATE_ADD(NOW(),INTERVAL 5 DAY),DATE_ADD(NOW(),INTERVAL 7 DAY),30,10,'offer',1,1,'random',JSON_ARRAY('هر نیمه ۶ دقیقه','وقت اضافه و پنالتی فعال','انتخاب تیم آزاد'),JSON_OBJECT('halfMinutes',6,'extraTime',true,'penalties',true),JSON_OBJECT('win',3,'draw',1,'loss',0),JSON_OBJECT('first',10000000),'linear-gradient(135deg,#0d7c47,#0b1118 58%,#d4a11f)',1,NOW()),
(2,UUID(),'backgammon-seven-point-summer','کاپ هفت‌امتیازی تخته‌نرد','مسابقه استاندارد هفت‌امتیازی با مرحله گروهی و حذفی.',2,2,2,'گروهی و سپس حذفی','INDIVIDUAL',1,40,10,500000,'PUBLISHED',DATE_ADD(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 9 DAY),DATE_ADD(NOW(),INTERVAL 12 DAY),45,10,'offer',1,0,'seeded',JSON_ARRAY('تا ۷ امتیاز','داور برای مراحل حساس','Doubling Cube اختیاری'),JSON_OBJECT('targetPoints',7,'doublingCube',false,'mars',true),JSON_OBJECT('win',3,'loss',0),JSON_OBJECT('first',15000000),'linear-gradient(135deg,#4b2f1c,#111827 55%,#d9a441)',0,NOW()),
(3,UUID(),'fc26-duo-night','شب دونفره FC 26','لیگ تیمی دو در برابر دو با جدول زنده.',1,3,1,'لیگ دوره‌ای','TEAM',2,16,4,700000,'RUNNING',DATE_SUB(NOW(),INTERVAL 20 DAY),DATE_SUB(NOW(),INTERVAL 2 DAY),NOW(),30,10,'manual',0,0,'custom',JSON_ARRAY('هر تیم دو بازیکن','برد ۳ امتیاز','تفاضل گل معیار دوم'),JSON_OBJECT('halfMinutes',6),JSON_OBJECT('win',3,'draw',1,'loss',0),JSON_OBJECT('first',8000000),'linear-gradient(135deg,#14213d,#101319 58%,#1dbb72)',0,NOW());

INSERT INTO `teams` (`id`,`public_id`,`title`,`created_by_id`) VALUES (1,UUID(),'تیم شاهین',2),(2,UUID(),'تیم آلفا',NULL),(3,UUID(),'تیم نارنجی',NULL),(4,UUID(),'تیم کافه',NULL);
INSERT INTO `team_members` (`team_id`,`player_id`,`is_captain`) VALUES (1,1,1),(1,2,0),(2,3,1),(2,4,0),(3,5,1),(3,6,0);

INSERT INTO `registrations` (`id`,`public_id`,`tournament_id`,`buyer_user_id`,`status`,`slots`,`subtotal`,`payable_amount`,`qr_token`,`reserved_until`) VALUES
(1,UUID(),1,2,'CONFIRMED',1,350000,350000,UUID(),DATE_ADD(NOW(),INTERVAL 1 DAY)),
(2,UUID(),1,NULL,'CONFIRMED',1,350000,350000,UUID(),DATE_ADD(NOW(),INTERVAL 1 DAY)),
(3,UUID(),3,2,'CHECKED_IN',1,700000,700000,UUID(),DATE_ADD(NOW(),INTERVAL 1 DAY));
INSERT INTO `registration_entries` (`registration_id`,`player_id`,`team_id`) VALUES (1,1,NULL),(2,2,NULL),(3,NULL,1);
INSERT INTO `payments` (`public_id`,`user_id`,`registration_id`,`method`,`provider`,`amount`,`status`,`tracking_code`,`approved_by`,`approved_at`) VALUES
(UUID(),2,1,'mock','mock',350000,'APPROVED','MOCK-1001',1,NOW()),
(UUID(),NULL,2,'receipt',NULL,350000,'PENDING',NULL,NULL,NULL),
(UUID(),2,3,'cash',NULL,700000,'APPROVED','CASH-1003',1,NOW());

INSERT INTO `tournament_rounds` (`id`,`tournament_id`,`title`,`round_number`,`stage`,`starts_at`) VALUES
(1,3,'هفته سوم',3,'league',NOW()),(2,1,'دور اول',1,'knockout',DATE_ADD(NOW(),INTERVAL 7 DAY));
INSERT INTO `tournament_matches` (`id`,`public_id`,`tournament_id`,`round_id`,`resource_id`,`match_number`,`status`,`scheduled_at`,`started_at`,`home_score`,`away_score`) VALUES
(1,UUID(),3,1,3,101,'LIVE',NOW(),NOW(),2,1),(2,UUID(),3,1,6,102,'LIVE',NOW(),NOW(),0,0),(3,UUID(),3,1,2,103,'READY',DATE_ADD(NOW(),INTERVAL 30 MINUTE),NULL,NULL,NULL);
INSERT INTO `match_participants` (`match_id`,`slot`,`team_id`) VALUES (1,1,1),(1,2,2),(2,1,3),(2,2,4);

INSERT INTO `ranking_boards` (`id`,`game_id`,`title`,`period_type`,`period_key`,`formula`) VALUES
(1,1,'رنکینگ تمام دوران FC 26','all_time','all',JSON_OBJECT('win',30,'draw',10,'participation',5,'noShow',-20)),
(2,2,'رنکینگ تمام دوران تخته‌نرد','all_time','all',JSON_OBJECT('win',30,'participation',5,'noShow',-20));
INSERT INTO `ranking_entries` (`board_id`,`player_id`,`points`,`wins`,`draws`,`losses`,`played`,`scored`,`conceded`) VALUES
(1,2,1260,14,1,3,18,49,22),(1,3,1215,15,2,4,21,54,28),(1,4,1180,12,2,3,17,41,25),(2,5,980,11,0,3,14,0,0),(2,6,954,12,0,4,16,0,0);

INSERT INTO `page_contents` (`slug`,`title`,`body`,`seo_title`,`seo_description`) VALUES
('home','صفحه اصلی','محتوای صفحه اصلی Coffee Game ستارخان','Coffee Game ستارخان','رزرو مسابقات FC 26 و تخته‌نرد'),
('rules','قوانین','قوانین عمومی ثبت‌نام، پرداخت، حضور و ثبت نتیجه.','قوانین مسابقات','قوانین Coffee Game ستارخان'),
('about','درباره ما','Coffee Game ستارخان، فضای بازی و رقابت.','درباره ما','معرفی مجموعه'),
('contact','تماس با ما','تهران، ستارخان - شماره تماس را از پنل ویرایش کنید.','تماس با ما','راه‌های ارتباطی');
INSERT INTO `announcements` (`slug`,`title`,`excerpt`,`body`,`is_published`,`published_at`) VALUES
('fc26-registration-open','ثبت‌نام جام جمعه FC 26 آغاز شد','ظرفیت محدود است.','ثبت‌نام از طریق صفحه مسابقه انجام می‌شود.',1,NOW());
INSERT INTO `gallery_items` (`title`,`image_url`,`category`,`sort_order`) VALUES ('لوگوی مجموعه','/brand/logo-dark.png','brand',1),('نسخه روشن لوگو','/brand/logo-light.png','brand',2);

INSERT INTO `app_settings` (`key`,`value`,`is_public`) VALUES
('club.profile',JSON_OBJECT('name','Coffee Game ستارخان','phone','02100000000','address','تهران، ستارخان'),1),
('club.resources',JSON_OBJECT('ps5',10,'backgammonTables',5),1),
('auth.settings',JSON_OBJECT('password',true,'sms',true,'google',false,'admin2fa','optional'),0),
('payment.settings',JSON_OBJECT('provider','mock','cash',true,'receipt',true,'partial',false),0),
('notification.settings',JSON_OBJECT('inApp',true,'email',false,'sms','optional'),0),
('security.auditRetentionDays',JSON_OBJECT('value',90),0);

SET FOREIGN_KEY_CHECKS = 1;

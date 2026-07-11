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

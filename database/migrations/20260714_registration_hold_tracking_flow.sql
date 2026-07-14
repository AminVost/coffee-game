-- Coffee Game Satarkhan
-- Registration hold, secure public tracking and payment correction flow.
-- Import this file ONCE on the existing database.

START TRANSACTION;

CREATE TABLE `registration_holds` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hold_token` char(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tournament_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `contact_mobile` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_data` json NOT NULL,
  `team_title` varchar(140) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `participant_type` enum('INDIVIDUAL','TEAM') COLLATE utf8mb4_unicode_ci NOT NULL,
  `slots` int NOT NULL DEFAULT '1',
  `amount` bigint NOT NULL,
  `status` enum('ACTIVE','CONVERTED','EXPIRED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `expires_at` datetime NOT NULL,
  `converted_registration_id` bigint UNSIGNED DEFAULT NULL,
  `request_ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_registration_holds_public_id` (`public_id`),
  UNIQUE KEY `uq_registration_holds_token` (`hold_token`),
  KEY `idx_registration_holds_capacity` (`tournament_id`,`status`,`expires_at`),
  KEY `idx_registration_holds_user_tournament` (`user_id`,`tournament_id`,`status`,`expires_at`),
  KEY `idx_registration_holds_mobile` (`contact_mobile`,`tournament_id`,`status`),
  KEY `idx_registration_holds_ip_created` (`request_ip`,`created_at`),
  CONSTRAINT `fk_registration_holds_tournament`
    FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_registration_holds_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_registration_holds_registration`
    FOREIGN KEY (`converted_registration_id`) REFERENCES `registrations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `registrations`
  MODIFY `status` enum(
    'RESERVED','PENDING_PAYMENT','PENDING_APPROVAL','NEEDS_CORRECTION',
    'CONFIRMED','WAITLISTED','CHECKED_IN','NO_SHOW','CANCELLED','REJECTED','EXPIRED'
  ) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_PAYMENT',
  ADD COLUMN `contact_mobile` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `buyer_user_id`,
  ADD COLUMN `tracking_code` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `qr_token`,
  ADD COLUMN `tracking_token` char(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `tracking_code`,
  ADD COLUMN `correction_expires_at` datetime DEFAULT NULL AFTER `reserved_until`,
  ADD COLUMN `source_hold_id` bigint UNSIGNED DEFAULT NULL AFTER `correction_expires_at`,
  ADD UNIQUE KEY `uq_registrations_tracking_code` (`tracking_code`),
  ADD UNIQUE KEY `uq_registrations_tracking_token` (`tracking_token`),
  ADD KEY `idx_registrations_correction_expiry` (`status`,`correction_expires_at`),
  ADD KEY `idx_registrations_contact_mobile` (`contact_mobile`,`created_at`),
  ADD KEY `idx_registrations_source_hold` (`source_hold_id`),
  ADD CONSTRAINT `fk_registrations_source_hold`
    FOREIGN KEY (`source_hold_id`) REFERENCES `registration_holds` (`id`) ON DELETE SET NULL;

ALTER TABLE `payments`
  MODIFY `status` enum(
    'PENDING','NEEDS_CORRECTION','APPROVED','REJECTED',
    'EXPIRED','CANCELLED','REFUNDED'
  ) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  ADD COLUMN `correction_expires_at` datetime DEFAULT NULL AFTER `rejected_reason`,
  ADD KEY `idx_payments_correction_expiry` (`status`,`correction_expires_at`);

UPDATE `registrations` r
LEFT JOIN `users` u ON u.id=r.buyer_user_id
SET
  r.contact_mobile=COALESCE(
    r.contact_mobile,
    u.mobile,
    (
      SELECT p.mobile
      FROM `registration_entries` re
      JOIN `players` p ON p.id=re.player_id
      WHERE re.registration_id=r.id AND p.mobile IS NOT NULL
      ORDER BY re.id ASC
      LIMIT 1
    ),
    (
      SELECT p2.mobile
      FROM `registration_entries` re2
      JOIN `team_members` tm ON tm.team_id=re2.team_id
      JOIN `players` p2 ON p2.id=tm.player_id
      WHERE re2.registration_id=r.id AND p2.mobile IS NOT NULL
      ORDER BY tm.is_captain DESC,tm.joined_at ASC
      LIMIT 1
    )
  ),
  r.tracking_code=COALESCE(
    r.tracking_code,
    CONCAT('CGS-',LPAD(r.id,8,'0'))
  ),
  r.tracking_token=COALESCE(
    r.tracking_token,
    SHA2(CONCAT(r.public_id,':',r.qr_token,':',UUID()),256)
  );

INSERT INTO `app_settings` (`key`,`value`,`is_public`,`updated_at`)
VALUES
  ('registration.holdMinutes',JSON_OBJECT('value',15),0,NOW()),
  ('registration.correctionHours',JSON_OBJECT('value',2),0,NOW())
ON DUPLICATE KEY UPDATE
  `value`=VALUES(`value`),
  `updated_at`=NOW();

COMMIT;

-- Coffee Game Satarkhan
-- Payment submission and centralized review flow
-- Safe to run once on the existing production/local database.

ALTER TABLE `payments`
  ADD COLUMN `payer_name` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `amount`,
  ADD COLUMN `payer_card_last4` char(4) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `payer_name`,
  ADD COLUMN `paid_on` date DEFAULT NULL AFTER `tracking_code`,
  ADD COLUMN `paid_time` time DEFAULT NULL AFTER `paid_on`,
  ADD COLUMN `submitted_at` datetime DEFAULT NULL AFTER `paid_time`,
  ADD KEY `idx_payments_review_queue` (`status`,`submitted_at`,`created_at`),
  ADD KEY `idx_payments_tracking_code` (`tracking_code`),
  ADD KEY `idx_payments_card_date` (`payer_card_last4`,`paid_on`);

-- Convert the old receipt-only method to the new bank-transfer method.
-- Existing receipt files remain linked and available.
UPDATE `payments`
SET
  `method` = 'card_to_card',
  `submitted_at` = COALESCE(`submitted_at`, `updated_at`)
WHERE `method` = 'receipt';

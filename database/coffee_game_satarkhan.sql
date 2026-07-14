-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Jul 14, 2026 at 03:35 PM
-- Server version: 9.1.0
-- PHP Version: 8.1.31

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `coffee_game_satarkhan`
--

-- --------------------------------------------------------

--
-- Table structure for table `announcements`
--

DROP TABLE IF EXISTS `announcements`;
CREATE TABLE IF NOT EXISTS `announcements` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `excerpt` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT '0',
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_announcements_slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `announcements`
--

INSERT INTO `announcements` (`id`, `slug`, `title`, `excerpt`, `body`, `image_url`, `is_published`, `published_at`, `created_at`, `updated_at`) VALUES
(1, 'fc26-registration-open', 'ثبت‌نام جام جمعه FC 26 آغاز شد', 'ظرفیت محدود است.', 'ثبت‌نام از طریق صفحه مسابقه انجام می‌شود.', NULL, 1, '2026-07-07 17:27:24', '2026-07-07 17:27:24', '2026-07-07 17:27:24');

-- --------------------------------------------------------

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` json NOT NULL,
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_app_settings_key` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `app_settings`
--

INSERT INTO `app_settings` (`id`, `key`, `value`, `is_public`, `updated_at`) VALUES
(1, 'club.profile', '{\"name\": \"Coffee Game ستارخان\", \"phone\": \"02100000000\", \"address\": \"تهران، ستارخان\"}', 1, '2026-07-07 17:27:24'),
(2, 'club.resources', '{\"ps5\": 10, \"backgammonTables\": 5}', 1, '2026-07-07 17:27:24'),
(3, 'auth.settings', '{\"sms\": true, \"google\": false, \"admin2fa\": \"optional\", \"password\": true}', 0, '2026-07-07 17:27:24'),
(4, 'payment.settings', '{\"cash\": true, \"partial\": false, \"receipt\": true, \"provider\": \"manual_transfer\"}', 0, '2026-07-07 17:27:24'),
(5, 'notification.settings', '{\"sms\": \"optional\", \"email\": false, \"inApp\": true}', 0, '2026-07-07 17:27:24'),
(6, 'security.auditRetentionDays', '{\"value\": 90}', 0, '2026-07-07 17:27:24'),
(7, 'security.sessionDays', '{\"value\": 7}', 0, '2026-07-11 21:09:52'),
(8, 'security.smsOtp', '{\"ttlMinutes\": 5, \"maxAttempts\": 5, \"cooldownSeconds\": 60}', 0, '2026-07-11 21:09:52'),
(9, 'registration.holdMinutes', '{\"value\": 15}', 0, '2026-07-14 18:30:46'),
(10, 'registration.correctionHours', '{\"value\": 2}', 0, '2026-07-14 18:30:46');

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `actor_user_id` bigint UNSIGNED DEFAULT NULL,
  `action` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_type` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entity_id` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `old_data` json DEFAULT NULL,
  `new_data` json DEFAULT NULL,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_created` (`created_at`),
  KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  KEY `fk_audit_actor` (`actor_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `audit_logs`
--

INSERT INTO `audit_logs` (`id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `old_data`, `new_data`, `ip_address`, `user_agent`, `created_at`) VALUES
(1, NULL, 'tournament.created', 'tournament', '4', NULL, '{\"slug\": \"tournament-1783794390924\", \"price\": 350000, \"rules\": [\"۱. هر بازیکن ۱۵ مهره دارد و باید همه مهره‌های خود را زودتر از حریف از صفحه خارج کند.\", \"۲. حرکت مهره‌ها بر اساس عدد دو تاس انجام می‌شود.\", \"۳. بازیکن باید در صورت امکان، هر دو عدد تاس را بازی کند.\", \"۴. در صورت جفت آمدن تاس، عدد تاس چهار بار بازی می‌شود.\", \"۵. مهره فقط می‌تواند روی خانه خالی، خانه دارای مهره خودی یا خانه‌ای با یک مهره حریف قرار بگیرد.\", \"۶. اگر روی یک خانه فقط یک مهره حریف باشد، آن مهره زده شده و به بار منتقل می‌شود.\", \"۷. بازیکنی که مهره در بار دارد، ابتدا باید آن مهره را وارد زمین کند و تا قبل از آن اجازه حرکت مهره‌های دیگر را ندارد.\"], \"title\": \"مسایقه تخته نرد ویژه\", \"format\": \"حذفی تک‌بازی\", \"gameId\": 2, \"status\": \"REGISTRATION_OPEN\", \"venueId\": 2, \"capacity\": 32, \"drawMode\": \"random\", \"startsAt\": \"2026-07-12T18:26:00.000Z\", \"teamSize\": 1, \"templateId\": null, \"description\": \"لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها، و شرایط سخت تایپ به پایان رسد و زمان مورد نیاز شامل حروفچینی دستاوردهای اصلی، و جوابگوی سوالات پیوسته اهل دنیای موجود طراحی اساسا مورد استفاده قرار گیرد.لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها، و شرایط سخت تایپ به پایان رسد و زمان مورد نیاز شامل حروفچینی دستاوردهای اصلی، و جوابگوی سوالات پیوسته اهل دنیای موجود طراحی اساسا مورد استفاده قرار گیرد.لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها، و شرایط سخت تایپ به پایان رسد و زمان مورد نیاز شامل حروفچینی دستاوردهای اصلی، و جوابگوی سوالات پیوسته اهل دنیای موجود طراحی اساسا مورد استفاده قرار گیرد.لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها، و شرایط سخت تایپ به پایان رسد و زمان مورد نیاز شامل حروفچینی دستاوردهای اصلی، و جوابگوی سوالات پیوسته اهل دنیای موجود طراحی اساسا مورد استفاده قرار گیرد.\", \"waitlistMode\": \"offer\", \"hasThirdPlace\": true, \"allowMultiSlot\": true, \"participantType\": \"INDIVIDUAL\", \"lateToleranceMin\": 10, \"reservationExpiresMin\": 30}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-11 21:59:21'),
(2, NULL, 'tournament_template.created', 'tournament_template', '4', NULL, '{\"title\": \"قالب مسایقه تخته نرد ویژه\", \"gameId\": 2, \"description\": \"لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که\", \"configuration\": {\"price\": 350000, \"rules\": [\"۱. هر بازیکن ۱۵ مهره دارد و باید همه مهره‌های خود را زودتر از حریف از صفحه خارج کند.\", \"۲. حرکت مهره‌ها بر اساس عدد دو تاس انجام می‌شود.\", \"۳. بازیکن باید در صورت امکان، هر دو عدد تاس را بازی کند.\", \"۴. در صورت جفت آمدن تاس، عدد تاس چهار بار بازی می‌شود.\", \"۵. مهره فقط می‌تواند روی خانه خالی، خانه دارای مهره خودی یا خانه‌ای با یک مهره حریف قرار بگیرد.\", \"۶. اگر روی یک خانه فقط یک مهره حریف باشد، آن مهره زده شده و به بار منتقل می‌شود.\", \"۷. بازیکنی که مهره در بار دارد، ابتدا باید آن مهره را وارد زمین کند و تا قبل از آن اجازه حرکت مهره‌های دیگر را ندارد.\"], \"format\": \"حذفی تک‌بازی\", \"capacity\": 32, \"drawMode\": \"random\", \"teamSize\": 1, \"waitlistMode\": \"offer\", \"hasThirdPlace\": true, \"allowMultiSlot\": true, \"participantType\": \"INDIVIDUAL\", \"lateToleranceMin\": 10, \"reservationExpiresMin\": 30}}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-11 21:59:21'),
(3, NULL, 'registration.created', 'registration', '4', NULL, '{\"slots\": 1, \"status\": \"PENDING_PAYMENT\", \"tournamentId\": 4, \"playerMobiles\": [\"09121111111\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-11 22:00:25'),
(4, NULL, 'registration.created', 'registration', '5', NULL, '{\"slots\": 1, \"status\": \"PENDING_PAYMENT\", \"tournamentId\": 4, \"playerMobiles\": [\"09121112111\"]}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-12 14:27:05'),
(5, NULL, 'tournament.created', 'tournament', '5', NULL, '{\"slug\": \"tournament-1783853952160\", \"price\": 350000, \"rules\": [\"fsjdgfojdsoigjds\", \"fdgopfdkgdktret\", \"etpohktroihjtrh\", \"trhtr\"], \"title\": \"iuhytj\", \"format\": \"حذفی تک‌بازی\", \"gameId\": 2, \"status\": \"REGISTRATION_OPEN\", \"venueId\": 1, \"capacity\": 32, \"drawMode\": \"random\", \"startsAt\": \"2026-07-13T10:59:00.000Z\", \"teamSize\": 1, \"templateId\": null, \"description\": \"\", \"waitlistMode\": \"automatic\", \"hasThirdPlace\": false, \"allowMultiSlot\": true, \"participantType\": \"INDIVIDUAL\", \"lateToleranceMin\": 10, \"reservationExpiresMin\": 30}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-12 14:31:31'),
(6, NULL, 'tournament_template.created', 'tournament_template', '5', NULL, '{\"title\": \"قالب iuhytj\", \"gameId\": 2, \"description\": \"\", \"configuration\": {\"price\": 350000, \"rules\": [\"fsjdgfojdsoigjds\", \"fdgopfdkgdktret\", \"etpohktroihjtrh\", \"trhtr\"], \"format\": \"حذفی تک‌بازی\", \"capacity\": 32, \"drawMode\": \"random\", \"teamSize\": 1, \"waitlistMode\": \"automatic\", \"hasThirdPlace\": false, \"allowMultiSlot\": true, \"participantType\": \"INDIVIDUAL\", \"lateToleranceMin\": 10, \"reservationExpiresMin\": 30}}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-12 14:31:31'),
(7, NULL, 'registration.created', 'registration', '6', NULL, '{\"slots\": 1, \"status\": \"PENDING_APPROVAL\", \"tournamentId\": 4, \"paymentMethod\": \"card_to_card\", \"playerMobiles\": [\"09121111112\"], \"paymentSubmitted\": true}', '::1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', '2026-07-14 17:05:59'),
(8, NULL, 'payment.receipt_uploaded', 'payment', '6', NULL, '{\"filePath\": \"receipts/6-4ac5f5ca-c34b-4355-83a1-db2a6d3f5e54.jpg\", \"fileSize\": 209211, \"mimeType\": \"image/jpeg\", \"optional\": true}', '::1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', '2026-07-14 17:05:59'),
(9, NULL, 'payment.approved', 'payment', '6', '{\"status\": \"PENDING\"}', '{\"method\": \"card_to_card\", \"reason\": null, \"status\": \"APPROVED\"}', '::1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', '2026-07-14 17:09:34'),
(10, NULL, 'registration.created_from_hold', 'registration', '7', NULL, '{\"slots\": 1, \"holdId\": 1, \"status\": \"PENDING_APPROVAL\", \"tournamentId\": 4, \"trackingCode\": \"CGS-17CA42D169\", \"paymentMethod\": \"card_to_card\", \"playerMobiles\": [\"09999999999\"], \"paymentSubmitted\": true}', '::1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', '2026-07-14 18:35:17'),
(11, NULL, 'payment.receipt_uploaded', 'payment', '7', NULL, '{\"filePath\": \"receipts/7-171d3bc8-c358-4511-9066-c5e8e048b7c1.png\", \"fileSize\": 1659432, \"mimeType\": \"image/png\", \"optional\": true}', '::1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', '2026-07-14 18:35:17'),
(12, 6, 'registration.created_from_hold', 'registration', '8', NULL, '{\"slots\": 1, \"holdId\": 2, \"status\": \"PENDING_APPROVAL\", \"tournamentId\": 4, \"trackingCode\": \"CGS-41DFB7B7C8\", \"paymentMethod\": \"card_to_card\", \"playerMobiles\": [\"09112222222\"], \"paymentSubmitted\": true}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-14 18:51:55'),
(13, 6, 'payment.receipt_uploaded', 'payment', '8', NULL, '{\"filePath\": \"receipts/8-e15c3bbd-6bf4-4f2c-ae84-00df89c9a4fb.png\", \"fileSize\": 2035611, \"mimeType\": \"image/png\", \"optional\": true}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-14 18:51:55'),
(14, 7, 'registration.created_from_hold', 'registration', '9', NULL, '{\"slots\": 1, \"holdId\": 3, \"status\": \"PENDING_APPROVAL\", \"tournamentId\": 4, \"trackingCode\": \"CGS-6BAD31B7F1\", \"paymentMethod\": \"card_to_card\", \"playerMobiles\": [\"09131234567\"], \"paymentSubmitted\": true}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-14 18:56:57'),
(15, 7, 'payment.receipt_uploaded', 'payment', '9', NULL, '{\"filePath\": \"receipts/9-d7f625b8-5162-4b86-a225-39c7cf968c6c.png\", \"fileSize\": 1800176, \"mimeType\": \"image/png\", \"optional\": true}', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-14 18:56:57'),
(16, 5, 'payment.correction_requested', 'payment', '9', '{\"status\": \"PENDING\"}', '{\"method\": \"card_to_card\", \"reason\": \"saat eshtebahe\", \"status\": \"NEEDS_CORRECTION\"}', '::1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', '2026-07-14 18:57:35'),
(17, 5, 'payment.rejected', 'payment', '8', '{\"status\": \"PENDING\"}', '{\"method\": \"card_to_card\", \"reason\": \"dssad\", \"status\": \"REJECTED\"}', '::1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', '2026-07-14 19:01:31');

-- --------------------------------------------------------

--
-- Table structure for table `discounts`
--

DROP TABLE IF EXISTS `discounts`;
CREATE TABLE IF NOT EXISTS `discounts` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `tournament_id` bigint UNSIGNED DEFAULT NULL,
  `code` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` bigint NOT NULL,
  `max_discount` bigint DEFAULT NULL,
  `usage_limit` int DEFAULT NULL,
  `per_user_limit` int NOT NULL DEFAULT '1',
  `starts_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_discounts_code` (`code`),
  KEY `fk_discounts_tournament` (`tournament_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `discount_usages`
--

DROP TABLE IF EXISTS `discount_usages`;
CREATE TABLE IF NOT EXISTS `discount_usages` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `discount_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `payment_id` bigint UNSIGNED DEFAULT NULL,
  `amount` bigint NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_discount_usages` (`discount_id`,`user_id`),
  KEY `fk_discount_usages_user` (`user_id`),
  KEY `fk_discount_usages_payment` (`payment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `gallery_items`
--

DROP TABLE IF EXISTS `gallery_items`;
CREATE TABLE IF NOT EXISTS `gallery_items` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `gallery_items`
--

INSERT INTO `gallery_items` (`id`, `title`, `image_url`, `category`, `sort_order`, `is_published`, `created_at`) VALUES
(1, 'لوگوی مجموعه', '/brand/logo-dark.png', 'brand', 1, 1, '2026-07-07 17:27:24'),
(2, 'نسخه روشن لوگو', '/brand/logo-light.png', 'brand', 2, 1, '2026-07-07 17:27:24');

-- --------------------------------------------------------

--
-- Table structure for table `games`
--

DROP TABLE IF EXISTS `games`;
CREATE TABLE IF NOT EXISTS `games` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `icon` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `result_schema` json DEFAULT NULL,
  `settings_schema` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_games_slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `games`
--

INSERT INTO `games` (`id`, `slug`, `title`, `description`, `icon`, `result_schema`, `settings_schema`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'fc26', 'FC 26 روی PS5', 'مسابقات فوتبال کنسولی انفرادی و تیمی', 'Gamepad2', '{\"awayScore\": \"number\", \"homeScore\": \"number\"}', '{\"extraTime\": true, \"penalties\": true, \"halfMinutes\": 6}', 1, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(2, 'backgammon', 'تخته‌نرد', 'مسابقات استاندارد امتیازی تخته‌نرد', 'Dices', '{\"awayScore\": \"number\", \"homeScore\": \"number\"}', '{\"mars\": true, \"doublingCube\": false, \"targetPoints\": 7}', 1, '2026-07-07 17:27:24', '2026-07-07 17:27:24');

-- --------------------------------------------------------

--
-- Table structure for table `match_disputes`
--

DROP TABLE IF EXISTS `match_disputes`;
CREATE TABLE IF NOT EXISTS `match_disputes` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `match_id` bigint UNSIGNED NOT NULL,
  `submitted_by` bigint UNSIGNED DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `resolution` text COLLATE utf8mb4_unicode_ci,
  `resolved_by` bigint UNSIGNED DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_disputes_match` (`match_id`),
  KEY `fk_disputes_submitter` (`submitted_by`),
  KEY `fk_disputes_resolver` (`resolved_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `match_participants`
--

DROP TABLE IF EXISTS `match_participants`;
CREATE TABLE IF NOT EXISTS `match_participants` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `match_id` bigint UNSIGNED NOT NULL,
  `slot` int NOT NULL,
  `player_id` bigint UNSIGNED DEFAULT NULL,
  `team_id` bigint UNSIGNED DEFAULT NULL,
  `seed` int DEFAULT NULL,
  `is_winner` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_match_slot` (`match_id`,`slot`),
  KEY `fk_match_participants_player` (`player_id`),
  KEY `fk_match_participants_team` (`team_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `match_participants`
--

INSERT INTO `match_participants` (`id`, `match_id`, `slot`, `player_id`, `team_id`, `seed`, `is_winner`) VALUES
(1, 1, 1, NULL, 1, NULL, 0),
(2, 1, 2, NULL, 2, NULL, 0),
(3, 2, 1, NULL, 3, NULL, 0),
(4, 2, 2, NULL, 4, NULL, 0);

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED NOT NULL,
  `type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` varchar(1000) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` json DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_read` (`user_id`,`read_at`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `user_id`, `type`, `title`, `body`, `data`, `read_at`, `created_at`) VALUES
(4, 6, 'registration_submitted', 'ثبت‌نام دریافت شد', 'اطلاعات پرداخت مسابقه مسایقه تخته نرد ویژه برای بررسی ارسال شد.', '{\"paymentId\": 8, \"trackingCode\": \"CGS-41DFB7B7C8\", \"registrationId\": 8}', NULL, '2026-07-14 18:51:55'),
(5, 5, 'admin_payment_submitted', 'پرداخت جدید نیازمند بررسی', 'پرداخت جدید برای مسابقه مسایقه تخته نرد ویژه ارسال شد.', '{\"paymentId\": 8, \"trackingCode\": \"CGS-41DFB7B7C8\", \"registrationId\": 8}', NULL, '2026-07-14 18:51:55'),
(6, 7, 'registration_submitted', 'ثبت‌نام دریافت شد', 'اطلاعات پرداخت مسابقه مسایقه تخته نرد ویژه برای بررسی ارسال شد.', '{\"paymentId\": 9, \"trackingCode\": \"CGS-6BAD31B7F1\", \"registrationId\": 9}', NULL, '2026-07-14 18:56:57'),
(7, 5, 'admin_payment_submitted', 'پرداخت جدید نیازمند بررسی', 'پرداخت جدید برای مسابقه مسایقه تخته نرد ویژه ارسال شد.', '{\"paymentId\": 9, \"trackingCode\": \"CGS-6BAD31B7F1\", \"registrationId\": 9}', NULL, '2026-07-14 18:56:57'),
(8, 7, 'payment_needs_correction', 'اطلاعات پرداخت نیاز به اصلاح دارد', 'پرداخت مسابقه مسایقه تخته نرد ویژه نیاز به اصلاح دارد: saat eshtebahe', '{\"paymentId\": 9, \"registrationId\": 9, \"correctionExpiresAt\": \"2026-07-14T17:27:35.863Z\"}', NULL, '2026-07-14 18:57:35'),
(9, 6, 'payment_rejected', 'پرداخت رد شد', 'پرداخت مسابقه مسایقه تخته نرد ویژه رد شد: dssad', '{\"paymentId\": 8, \"registrationId\": 8}', NULL, '2026-07-14 19:01:31');

-- --------------------------------------------------------

--
-- Table structure for table `otp_codes`
--

DROP TABLE IF EXISTS `otp_codes`;
CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `destination` varchar(190) COLLATE utf8mb4_unicode_ci NOT NULL,
  `purpose` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `attempts` int NOT NULL DEFAULT '0',
  `request_ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `consumed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_destination` (`destination`,`purpose`,`expires_at`),
  KEY `idx_otp_user_created` (`user_id`,`created_at`),
  KEY `idx_otp_ip_created` (`request_ip`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `otp_codes`
--

INSERT INTO `otp_codes` (`id`, `destination`, `purpose`, `code_hash`, `attempts`, `expires_at`, `consumed_at`, `created_at`) VALUES
(1, '09120000000', 'login', '$2b$10$rxWpU5osuifQ5bgnHZ7MqORpd3vJ5xc4yEwOWiLhnqd/qeHw.K24K', 0, '2026-07-12 13:25:37', '2026-07-12 13:20:41', '2026-07-12 13:20:37'),
(2, '09120000000', 'login', '$2b$10$Vj1SblI6bxFrhocAFEZsH..6NPrJkM12OCvmCE/9Zta14gDfYtRYO', 0, '2026-07-12 14:38:25', '2026-07-12 14:33:28', '2026-07-12 14:33:25'),
(3, '09121111112', 'login', '$2b$10$Pjxwlh7D2wmea2DGQuNyguXs3YZ1BTuIAn/J7w8mGtSQMnYjpZQWq', 0, '2026-07-14 17:15:54', '2026-07-14 17:11:04', '2026-07-14 17:10:54'),
(4, '09120000000', 'login', '$2b$10$QNuJWCc/6icriNgMa0Swee8M0JfdgXpL0Z4F.NgHFmRIvwshqy9/G', 0, '2026-07-14 17:16:26', '2026-07-14 17:11:28', '2026-07-14 17:11:26'),
(5, '09121111112', 'login', '$2b$10$1Nhf7a0bBOM2A6kyoMpgJe7p.X7FnmXerEBOg2JkmFidHVVWOmPh6', 0, '2026-07-14 17:23:12', NULL, '2026-07-14 17:18:12'),
(6, '09120000000', 'login', '$2b$10$t9AvJA9QFQEu5Ejyg1pPneFp0Y.ub5cKF7t8CBfvVu3FN8TFb/oZC', 0, '2026-07-14 18:44:55', NULL, '2026-07-14 18:39:55'),
(7, '09112222222', 'login', '$2b$10$PxJg8vuRJFfl4SiV1ZCxbOkat0CPT5fGxztb1bXWu0gR0qwHn0eSW', 0, '2026-07-14 18:52:42', '2026-07-14 18:50:55', '2026-07-14 18:47:42'),
(8, '09131234567', 'login', '$2b$10$lrD4AdJEiH5QaDrvKwoLqekHfwMBOwMp9l1Y7vUsJ3TXmpCoJvkf6', 0, '2026-07-14 19:00:03', '2026-07-14 18:55:11', '2026-07-14 18:55:03');

-- --------------------------------------------------------

--
-- Table structure for table `page_contents`
--

DROP TABLE IF EXISTS `page_contents`;
CREATE TABLE IF NOT EXISTS `page_contents` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `slug` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `seo_title` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `seo_description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_published` tinyint(1) NOT NULL DEFAULT '1',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_page_contents_slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `page_contents`
--

INSERT INTO `page_contents` (`id`, `slug`, `title`, `body`, `seo_title`, `seo_description`, `is_published`, `updated_at`) VALUES
(1, 'home', 'صفحه اصلی', 'محتوای صفحه اصلی Coffee Game ستارخان', 'Coffee Game ستارخان', 'رزرو مسابقات FC 26 و تخته‌نرد', 1, '2026-07-07 17:27:24'),
(2, 'rules', 'قوانین', 'قوانین عمومی ثبت‌نام، پرداخت، حضور و ثبت نتیجه.', 'قوانین مسابقات', 'قوانین Coffee Game ستارخان', 1, '2026-07-07 17:27:24'),
(3, 'about', 'درباره ما', 'Coffee Game ستارخان، فضای بازی و رقابت.', 'درباره ما', 'معرفی مجموعه', 1, '2026-07-07 17:27:24'),
(4, 'contact', 'تماس با ما', 'تهران، ستارخان - شماره تماس را از پنل ویرایش کنید.', 'تماس با ما', 'راه‌های ارتباطی', 1, '2026-07-07 17:27:24');

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
CREATE TABLE IF NOT EXISTS `payments` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `registration_id` bigint UNSIGNED NOT NULL,
  `method` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `provider` varchar(60) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` bigint NOT NULL,
  `payer_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payer_card_last4` char(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('PENDING','NEEDS_CORRECTION','APPROVED','REJECTED','EXPIRED','CANCELLED','REFUNDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `tracking_code` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_on` date DEFAULT NULL,
  `paid_time` time DEFAULT NULL,
  `submitted_at` datetime DEFAULT NULL,
  `provider_payload` json DEFAULT NULL,
  `approved_by` bigint UNSIGNED DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejected_reason` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `correction_expires_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payments_public_id` (`public_id`),
  KEY `idx_payments_registration_status` (`registration_id`,`status`),
  KEY `fk_payments_user` (`user_id`),
  KEY `fk_payments_approver` (`approved_by`),
  KEY `idx_payments_review_queue` (`status`,`submitted_at`,`created_at`),
  KEY `idx_payments_tracking_code` (`tracking_code`),
  KEY `idx_payments_card_date` (`payer_card_last4`,`paid_on`),
  KEY `idx_payments_correction_expiry` (`status`,`correction_expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`id`, `public_id`, `user_id`, `registration_id`, `method`, `provider`, `amount`, `payer_name`, `payer_card_last4`, `status`, `tracking_code`, `paid_on`, `paid_time`, `submitted_at`, `provider_payload`, `approved_by`, `approved_at`, `rejected_reason`, `correction_expires_at`, `created_at`, `updated_at`) VALUES
(8, '9d82de5a-0b49-4be8-90e1-f4ca603b3f0a', 6, 8, 'card_to_card', NULL, 350000, 'ali almasi', '2222', 'REJECTED', '123456', '2026-07-14', NULL, '2026-07-14 18:51:56', NULL, NULL, NULL, 'dssad', NULL, '2026-07-14 18:51:55', '2026-07-14 19:01:31'),
(9, '359de1a1-da45-49ca-bacb-03092ef437b1', 7, 9, 'card_to_card', NULL, 350000, 'variz anbir', '5555', 'NEEDS_CORRECTION', '12321321321', '2026-07-14', NULL, '2026-07-14 18:56:57', NULL, NULL, NULL, 'saat eshtebahe', '2026-07-14 20:57:36', '2026-07-14 18:56:57', '2026-07-14 18:57:35');

-- --------------------------------------------------------

--
-- Table structure for table `payment_receipts`
--

DROP TABLE IF EXISTS `payment_receipts`;
CREATE TABLE IF NOT EXISTS `payment_receipts` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id` bigint UNSIGNED NOT NULL,
  `file_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_size` int NOT NULL,
  `uploaded_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipts_payment` (`payment_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payment_receipts`
--

INSERT INTO `payment_receipts` (`id`, `payment_id`, `file_path`, `mime_type`, `file_size`, `uploaded_at`) VALUES
(3, 8, 'receipts/8-e15c3bbd-6bf4-4f2c-ae84-00df89c9a4fb.png', 'image/png', 2035611, '2026-07-14 18:51:55'),
(4, 9, 'receipts/9-d7f625b8-5162-4b86-a225-39c7cf968c6c.png', 'image/png', 1800176, '2026-07-14 18:56:57');

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

DROP TABLE IF EXISTS `permissions`;
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `group_name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permissions_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `name`, `title`, `group_name`) VALUES
(1, 'tournaments.view', 'مشاهده مسابقات', 'tournaments'),
(2, 'tournaments.manage', 'مدیریت مسابقات', 'tournaments'),
(3, 'templates.manage', 'مدیریت قالب‌ها', 'tournaments'),
(4, 'draws.manage', 'مدیریت قرعه', 'matches'),
(5, 'matches.manage', 'مدیریت بازی‌ها', 'matches'),
(6, 'results.submit', 'ثبت نتیجه', 'matches'),
(7, 'payments.view', 'مشاهده پرداخت‌ها', 'payments'),
(8, 'payments.approve', 'تایید پرداخت', 'payments'),
(9, 'users.manage', 'مدیریت کاربران', 'users'),
(10, 'roles.manage', 'مدیریت نقش‌ها', 'users'),
(11, 'content.manage', 'مدیریت محتوا', 'content'),
(12, 'settings.manage', 'مدیریت تنظیمات', 'system'),
(13, 'audit.view', 'مشاهده تاریخچه', 'system'),
(14, 'checkin.manage', 'مدیریت حضور', 'registrations'),
(29, 'players.view', 'مشاهده بازیکنان', 'users');

-- --------------------------------------------------------

--
-- Table structure for table `players`
--

DROP TABLE IF EXISTS `players`;
CREATE TABLE IF NOT EXISTS `players` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` bigint UNSIGNED DEFAULT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mobile` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_guest` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_players_mobile` (`mobile`),
  KEY `idx_players_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `players`
--

INSERT INTO `players` (`id`, `user_id`, `name`, `mobile`, `avatar_url`, `is_guest`, `created_at`, `updated_at`) VALUES
(1, NULL, 'بازیکن آزمایشی', '09120000002', NULL, 0, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(2, NULL, 'امین', '09121111111', NULL, 1, '2026-07-07 17:27:24', '2026-07-11 22:00:25'),
(3, NULL, 'مهدی کریمی', '09122222222', NULL, 1, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(4, NULL, 'کیان فرهمند', '09123333333', NULL, 1, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(5, NULL, 'فرهاد کاظمی', '09124444444', NULL, 1, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(6, NULL, 'بابک احمدی', '09125555555', NULL, 1, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(7, NULL, 'کاربر 0000', '09120000000', NULL, 0, '2026-07-12 13:20:41', '2026-07-14 17:11:28'),
(8, NULL, 'dsfgfdsg', '09121112111', NULL, 1, '2026-07-12 14:27:05', '2026-07-12 14:27:05'),
(9, NULL, 'کاربر 1112', '09121111112', NULL, 0, '2026-07-14 17:05:59', '2026-07-14 17:11:04'),
(10, NULL, 'reza abasi', '09999999999', NULL, 1, '2026-07-14 18:35:17', '2026-07-14 18:35:17'),
(11, 5, 'amin vosta', '09901559940', NULL, 0, '2026-07-14 18:43:25', '2026-07-14 18:43:25'),
(12, 6, 'ali almasi', '09112222222', NULL, 0, '2026-07-14 18:50:55', '2026-07-14 18:50:55'),
(13, 7, 'ali anbir', '09131234567', NULL, 0, '2026-07-14 18:55:11', '2026-07-14 18:55:11');

-- --------------------------------------------------------

--
-- Table structure for table `ranking_boards`
--

DROP TABLE IF EXISTS `ranking_boards`;
CREATE TABLE IF NOT EXISTS `ranking_boards` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_id` int UNSIGNED NOT NULL,
  `title` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_type` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `period_key` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `formula` json NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ranking_board` (`game_id`,`period_type`,`period_key`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `ranking_boards`
--

INSERT INTO `ranking_boards` (`id`, `game_id`, `title`, `period_type`, `period_key`, `formula`, `is_active`) VALUES
(1, 1, 'رنکینگ تمام دوران FC 26', 'all_time', 'all', '{\"win\": 30, \"draw\": 10, \"noShow\": -20, \"participation\": 5}', 1),
(2, 2, 'رنکینگ تمام دوران تخته‌نرد', 'all_time', 'all', '{\"win\": 30, \"noShow\": -20, \"participation\": 5}', 1);

-- --------------------------------------------------------

--
-- Table structure for table `ranking_entries`
--

DROP TABLE IF EXISTS `ranking_entries`;
CREATE TABLE IF NOT EXISTS `ranking_entries` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `board_id` bigint UNSIGNED NOT NULL,
  `player_id` bigint UNSIGNED NOT NULL,
  `points` decimal(12,2) NOT NULL DEFAULT '0.00',
  `wins` int NOT NULL DEFAULT '0',
  `draws` int NOT NULL DEFAULT '0',
  `losses` int NOT NULL DEFAULT '0',
  `played` int NOT NULL DEFAULT '0',
  `scored` int NOT NULL DEFAULT '0',
  `conceded` int NOT NULL DEFAULT '0',
  `adjustment` decimal(12,2) NOT NULL DEFAULT '0.00',
  `metadata` json DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ranking_entry` (`board_id`,`player_id`),
  KEY `fk_ranking_entries_player` (`player_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `ranking_entries`
--

INSERT INTO `ranking_entries` (`id`, `board_id`, `player_id`, `points`, `wins`, `draws`, `losses`, `played`, `scored`, `conceded`, `adjustment`, `metadata`, `updated_at`) VALUES
(1, 1, 2, 1260.00, 14, 1, 3, 18, 49, 22, 0.00, NULL, '2026-07-07 17:27:24'),
(2, 1, 3, 1215.00, 15, 2, 4, 21, 54, 28, 0.00, NULL, '2026-07-07 17:27:24'),
(3, 1, 4, 1180.00, 12, 2, 3, 17, 41, 25, 0.00, NULL, '2026-07-07 17:27:24'),
(4, 2, 5, 980.00, 11, 0, 3, 14, 0, 0, 0.00, NULL, '2026-07-07 17:27:24'),
(5, 2, 6, 954.00, 12, 0, 4, 16, 0, 0, 0.00, NULL, '2026-07-07 17:27:24');

-- --------------------------------------------------------

--
-- Table structure for table `registrations`
--

DROP TABLE IF EXISTS `registrations`;
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tournament_id` bigint UNSIGNED NOT NULL,
  `buyer_user_id` bigint UNSIGNED DEFAULT NULL,
  `contact_mobile` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('RESERVED','PENDING_PAYMENT','PENDING_APPROVAL','NEEDS_CORRECTION','CONFIRMED','WAITLISTED','CHECKED_IN','NO_SHOW','CANCELLED','REJECTED','EXPIRED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING_PAYMENT',
  `slots` int NOT NULL DEFAULT '1',
  `subtotal` bigint NOT NULL,
  `discount_amount` bigint NOT NULL DEFAULT '0',
  `payable_amount` bigint NOT NULL,
  `invite_code` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `qr_token` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tracking_code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tracking_token` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reserved_until` datetime DEFAULT NULL,
  `correction_expires_at` datetime DEFAULT NULL,
  `source_hold_id` bigint UNSIGNED DEFAULT NULL,
  `checked_in_at` datetime DEFAULT NULL,
  `no_show_at` datetime DEFAULT NULL,
  `notes` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_registrations_public_id` (`public_id`),
  UNIQUE KEY `uq_registrations_qr` (`qr_token`),
  UNIQUE KEY `uq_registrations_tracking_code` (`tracking_code`),
  UNIQUE KEY `uq_registrations_tracking_token` (`tracking_token`),
  KEY `idx_registrations_tournament_status` (`tournament_id`,`status`,`created_at`),
  KEY `fk_registrations_buyer` (`buyer_user_id`),
  KEY `idx_registrations_correction_expiry` (`status`,`correction_expires_at`),
  KEY `idx_registrations_contact_mobile` (`contact_mobile`,`created_at`),
  KEY `idx_registrations_source_hold` (`source_hold_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `registrations`
--

INSERT INTO `registrations` (`id`, `public_id`, `tournament_id`, `buyer_user_id`, `contact_mobile`, `status`, `slots`, `subtotal`, `discount_amount`, `payable_amount`, `invite_code`, `qr_token`, `tracking_code`, `tracking_token`, `reserved_until`, `correction_expires_at`, `source_hold_id`, `checked_in_at`, `no_show_at`, `notes`, `deleted_at`, `created_at`, `updated_at`) VALUES
(8, '1b771085-b415-4127-b02f-849a9199aaef', 4, 6, '09112222222', 'REJECTED', 1, 350000, 0, 350000, NULL, '7d83c63c-e590-427e-ad76-014cf1c829a7', 'CGS-41DFB7B7C8', 'fefaf116ea3bfcaea79733646d079c6cdcbd324ab08d778c05fdc4345afc49d4', NULL, NULL, 2, NULL, NULL, NULL, NULL, '2026-07-14 18:51:55', '2026-07-14 19:01:31'),
(9, 'a386dded-e1ff-4256-bcdc-be17b1f558bb', 4, 7, '09131234567', 'CONFIRMED', 1, 350000, 0, 350000, NULL, '5fdb809e-0e8d-4bad-90b5-7b0948ac46f4', 'CGS-6BAD31B7F1', 'f6f9850a3c4d40b398dd7759f78798f76d6da671e1061332a4a6cf449fc03b61', NULL, '2026-07-14 20:57:36', 3, NULL, NULL, NULL, NULL, '2026-07-14 18:56:57', '2026-07-14 19:00:45');

-- --------------------------------------------------------

--
-- Table structure for table `registration_entries`
--

DROP TABLE IF EXISTS `registration_entries`;
CREATE TABLE IF NOT EXISTS `registration_entries` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` bigint UNSIGNED NOT NULL,
  `player_id` bigint UNSIGNED DEFAULT NULL,
  `team_id` bigint UNSIGNED DEFAULT NULL,
  `seed` int DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_entries_registration` (`registration_id`),
  KEY `fk_entries_player` (`player_id`),
  KEY `fk_entries_team` (`team_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `registration_entries`
--

INSERT INTO `registration_entries` (`id`, `registration_id`, `player_id`, `team_id`, `seed`, `confirmed_at`) VALUES
(8, 8, 12, NULL, NULL, NULL),
(9, 9, 13, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `registration_holds`
--

DROP TABLE IF EXISTS `registration_holds`;
CREATE TABLE IF NOT EXISTS `registration_holds` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `hold_token` char(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tournament_id` bigint UNSIGNED NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `contact_mobile` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `player_data` json NOT NULL,
  `team_title` varchar(140) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `participant_type` enum('INDIVIDUAL','TEAM') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `slots` int NOT NULL DEFAULT '1',
  `amount` bigint NOT NULL,
  `status` enum('ACTIVE','CONVERTED','EXPIRED','CANCELLED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `expires_at` datetime NOT NULL,
  `converted_registration_id` bigint UNSIGNED DEFAULT NULL,
  `request_ip` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_registration_holds_public_id` (`public_id`),
  UNIQUE KEY `uq_registration_holds_token` (`hold_token`),
  KEY `idx_registration_holds_capacity` (`tournament_id`,`status`,`expires_at`),
  KEY `idx_registration_holds_user_tournament` (`user_id`,`tournament_id`,`status`,`expires_at`),
  KEY `idx_registration_holds_mobile` (`contact_mobile`,`tournament_id`,`status`),
  KEY `idx_registration_holds_ip_created` (`request_ip`,`created_at`),
  KEY `fk_registration_holds_registration` (`converted_registration_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `registration_holds`
--

INSERT INTO `registration_holds` (`id`, `public_id`, `hold_token`, `tournament_id`, `user_id`, `contact_mobile`, `player_data`, `team_title`, `participant_type`, `slots`, `amount`, `status`, `expires_at`, `converted_registration_id`, `request_ip`, `user_agent`, `created_at`, `updated_at`) VALUES
(2, '5af8a900-b259-475f-b5cb-8dde9f045759', 'b615fea8fab1f29361fc593d2d0f6dbdd3f027837a31ce1482daf008878775d5', 4, 6, '09112222222', '[{\"name\": \"ali almasi\", \"mobile\": \"09112222222\"}]', NULL, 'INDIVIDUAL', 1, 350000, 'CONVERTED', '2026-07-14 19:05:55', 8, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-14 18:50:55', '2026-07-14 18:51:55'),
(3, 'f9cb2882-5520-4398-8fb9-161117eb0da5', '9e32a5a58ca8581f7721845a06f7067301c63d1e87e14d380edd4799861e6c29', 4, 7, '09131234567', '[{\"name\": \"ali anbir\", \"mobile\": \"09131234567\"}]', NULL, 'INDIVIDUAL', 1, 350000, 'CONVERTED', '2026-07-14 19:10:12', 9, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-14 18:55:12', '2026-07-14 18:56:57');

-- --------------------------------------------------------

--
-- Table structure for table `resources`
--

DROP TABLE IF EXISTS `resources`;
CREATE TABLE IF NOT EXISTS `resources` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `venue_id` int UNSIGNED NOT NULL,
  `code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'available',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `metadata` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_resources_code` (`code`),
  KEY `idx_resources_venue_type` (`venue_id`,`type`,`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `resources`
--

INSERT INTO `resources` (`id`, `venue_id`, `code`, `title`, `type`, `status`, `is_active`, `metadata`) VALUES
(1, 1, 'PS5-01', 'PS5 شماره ۱', 'ps5', 'available', 1, NULL),
(2, 1, 'PS5-02', 'PS5 شماره ۲', 'ps5', 'available', 1, NULL),
(3, 1, 'PS5-03', 'PS5 شماره ۳', 'ps5', 'available', 1, NULL),
(4, 1, 'PS5-04', 'PS5 شماره ۴', 'ps5', 'available', 1, NULL),
(5, 1, 'PS5-05', 'PS5 شماره ۵', 'ps5', 'available', 1, NULL),
(6, 1, 'PS5-06', 'PS5 شماره ۶', 'ps5', 'available', 1, NULL),
(7, 1, 'PS5-07', 'PS5 شماره ۷', 'ps5', 'available', 1, NULL),
(8, 1, 'PS5-08', 'PS5 شماره ۸', 'ps5', 'available', 1, NULL),
(9, 1, 'PS5-09', 'PS5 شماره ۹', 'ps5', 'available', 1, NULL),
(10, 1, 'PS5-10', 'PS5 شماره ۱۰', 'ps5', 'available', 1, NULL),
(11, 1, 'BG-01', 'میز تخته‌نرد ۱', 'backgammon_table', 'available', 1, NULL),
(12, 1, 'BG-02', 'میز تخته‌نرد ۲', 'backgammon_table', 'available', 1, NULL),
(13, 1, 'BG-03', 'میز تخته‌نرد ۳', 'backgammon_table', 'available', 1, NULL),
(14, 1, 'BG-04', 'میز تخته‌نرد ۴', 'backgammon_table', 'available', 1, NULL),
(15, 1, 'BG-05', 'میز تخته‌نرد ۵', 'backgammon_table', 'available', 1, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
CREATE TABLE IF NOT EXISTS `roles` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `title`, `description`, `is_system`, `created_at`) VALUES
(1, 'super_admin', 'مدیر اصلی', 'دسترسی کامل به سیستم', 1, '2026-07-07 17:27:24'),
(2, 'manager', 'مدیر', 'مدیریت مسابقات و کاربران', 1, '2026-07-07 17:27:24'),
(3, 'operator', 'اپراتور مسابقه', 'قرعه، زمان‌بندی و شرکت‌کنندگان', 1, '2026-07-07 17:27:24'),
(4, 'referee', 'داور', 'ثبت نتایج مسابقات تخصیص‌یافته', 1, '2026-07-07 17:27:24'),
(5, 'cashier', 'صندوق‌دار', 'مدیریت پرداخت حضوری و فیش', 1, '2026-07-07 17:27:24'),
(6, 'content_manager', 'مدیر محتوا', 'مدیریت صفحات، اخبار و گالری', 1, '2026-07-07 17:27:24'),
(7, 'player', 'بازیکن', 'کاربر ثبت‌نام‌شده', 1, '2026-07-07 17:27:24'),
(8, 'guest', 'مهمان', 'شرکت‌کننده مهمان', 1, '2026-07-07 17:27:24');

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` int UNSIGNED NOT NULL,
  `permission_id` int UNSIGNED NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `fk_role_permissions_permission` (`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `role_permissions`
--

INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(1, 1),
(2, 1),
(3, 1),
(4, 1),
(7, 1),
(1, 2),
(2, 2),
(1, 3),
(2, 3),
(1, 4),
(2, 4),
(3, 4),
(1, 5),
(2, 5),
(3, 5),
(4, 5),
(1, 6),
(2, 6),
(3, 6),
(4, 6),
(1, 7),
(2, 7),
(5, 7),
(1, 8),
(2, 8),
(5, 8),
(1, 9),
(2, 9),
(1, 10),
(1, 11),
(2, 11),
(6, 11),
(1, 12),
(1, 13),
(2, 13),
(1, 14),
(2, 14),
(3, 14),
(1, 29),
(2, 29);

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `token_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` bigint UNSIGNED NOT NULL,
  `ip_address` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_token` (`token_hash`),
  KEY `idx_sessions_user_expiry` (`user_id`,`expires_at`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`id`, `token_hash`, `user_id`, `ip_address`, `user_agent`, `expires_at`, `revoked_at`, `created_at`) VALUES
(10, '753fd372b09a67b32851d753a93149c76b79b58cf75bceb390164ea783748db1', 5, '::1', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1', '2026-07-21 18:45:47', '2026-07-14 18:46:30', '2026-07-14 18:45:46'),
(11, '65bd4dcc62637ce4743920657df5e3ce8f2d4f7ac87604fb65198a97270d9cf7', 5, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-21 18:46:43', NULL, '2026-07-14 18:46:43'),
(12, 'dea3656d0feae8c1eeebce8a9a8570c0840df411fd89c90702f6f2fb629e886c', 6, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-21 18:50:55', NULL, '2026-07-14 18:50:55'),
(13, '3cb61ae869feaa88d48bca6d759ff76d0915d08a0e16c9b3fb6dadeecfb91caf', 7, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36', '2026-07-21 18:55:12', NULL, '2026-07-14 18:55:11');

-- --------------------------------------------------------

--
-- Table structure for table `sponsors`
--

DROP TABLE IF EXISTS `sponsors`;
CREATE TABLE IF NOT EXISTS `sponsors` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `logo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `teams`
--

DROP TABLE IF EXISTS `teams`;
CREATE TABLE IF NOT EXISTS `teams` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(140) COLLATE utf8mb4_unicode_ci NOT NULL,
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_id` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_teams_public_id` (`public_id`),
  KEY `fk_teams_creator` (`created_by_id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `teams`
--

INSERT INTO `teams` (`id`, `public_id`, `title`, `avatar_url`, `created_by_id`, `created_at`, `updated_at`) VALUES
(1, 'c8217f18-7a0b-11f1-974d-482ae3135c88', 'تیم شاهین', NULL, NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(2, 'c8218329-7a0b-11f1-974d-482ae3135c88', 'تیم آلفا', NULL, NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(3, 'c8218508-7a0b-11f1-974d-482ae3135c88', 'تیم نارنجی', NULL, NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(4, 'c8218683-7a0b-11f1-974d-482ae3135c88', 'تیم کافه', NULL, NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24');

-- --------------------------------------------------------

--
-- Table structure for table `team_members`
--

DROP TABLE IF EXISTS `team_members`;
CREATE TABLE IF NOT EXISTS `team_members` (
  `team_id` bigint UNSIGNED NOT NULL,
  `player_id` bigint UNSIGNED NOT NULL,
  `is_captain` tinyint(1) NOT NULL DEFAULT '0',
  `joined_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`team_id`,`player_id`),
  KEY `fk_team_members_player` (`player_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `team_members`
--

INSERT INTO `team_members` (`team_id`, `player_id`, `is_captain`, `joined_at`) VALUES
(1, 1, 1, '2026-07-07 17:27:24'),
(1, 2, 0, '2026-07-07 17:27:24'),
(2, 3, 1, '2026-07-07 17:27:24'),
(2, 4, 0, '2026-07-07 17:27:24'),
(3, 5, 1, '2026-07-07 17:27:24'),
(3, 6, 0, '2026-07-07 17:27:24');

-- --------------------------------------------------------

--
-- Table structure for table `tournaments`
--

DROP TABLE IF EXISTS `tournaments`;
CREATE TABLE IF NOT EXISTS `tournaments` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `subtitle` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `game_id` int UNSIGNED NOT NULL,
  `template_id` bigint UNSIGNED DEFAULT NULL,
  `venue_id` int UNSIGNED DEFAULT NULL,
  `format` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL,
  `participant_type` enum('INDIVIDUAL','TEAM') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INDIVIDUAL',
  `team_size` int NOT NULL DEFAULT '1',
  `capacity` int NOT NULL,
  `min_participants` int NOT NULL DEFAULT '2',
  `price` bigint NOT NULL DEFAULT '0',
  `currency` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'TOMAN',
  `status` enum('DRAFT','PUBLISHED','REGISTRATION_OPEN','REGISTRATION_CLOSED','DRAW_READY','RUNNING','COMPLETED','POSTPONED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'DRAFT',
  `registration_starts_at` datetime DEFAULT NULL,
  `registration_ends_at` datetime DEFAULT NULL,
  `starts_at` datetime NOT NULL,
  `ends_at` datetime DEFAULT NULL,
  `reservation_expires_min` int NOT NULL DEFAULT '30',
  `late_tolerance_min` int NOT NULL DEFAULT '10',
  `waitlist_mode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'offer',
  `allow_multi_slot` tinyint(1) NOT NULL DEFAULT '0',
  `has_third_place` tinyint(1) NOT NULL DEFAULT '0',
  `draw_mode` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'random',
  `rules` json DEFAULT NULL,
  `game_settings` json DEFAULT NULL,
  `scoring_settings` json DEFAULT NULL,
  `notification_settings` json DEFAULT NULL,
  `cancellation_settings` json DEFAULT NULL,
  `prize_settings` json DEFAULT NULL,
  `cover_image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_featured` tinyint(1) NOT NULL DEFAULT '0',
  `published_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tournaments_public_id` (`public_id`),
  UNIQUE KEY `uq_tournaments_slug` (`slug`),
  KEY `idx_tournaments_game_status_date` (`game_id`,`status`,`starts_at`),
  KEY `fk_tournaments_template` (`template_id`),
  KEY `fk_tournaments_venue` (`venue_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tournaments`
--

INSERT INTO `tournaments` (`id`, `public_id`, `slug`, `title`, `subtitle`, `description`, `game_id`, `template_id`, `venue_id`, `format`, `participant_type`, `team_size`, `capacity`, `min_participants`, `price`, `currency`, `status`, `registration_starts_at`, `registration_ends_at`, `starts_at`, `ends_at`, `reservation_expires_min`, `late_tolerance_min`, `waitlist_mode`, `allow_multi_slot`, `has_third_place`, `draw_mode`, `rules`, `game_settings`, `scoring_settings`, `notification_settings`, `cancellation_settings`, `prize_settings`, `cover_image_url`, `is_featured`, `published_at`, `deleted_at`, `created_at`, `updated_at`) VALUES
(1, 'c81c2a9f-7a0b-11f1-974d-482ae3135c88', 'fc26-friday-cup-01', 'جام جمعه FC 26', NULL, 'جام سریع FC 26 با قرعه‌کشی زنده و زمان‌بندی خودکار.', 1, 1, 1, 'حذفی تک‌بازی', 'INDIVIDUAL', 1, 32, 8, 350000, 'TOMAN', 'REGISTRATION_OPEN', '2026-07-07 17:27:24', '2026-07-12 17:27:24', '2026-07-14 17:27:24', NULL, 30, 10, 'offer', 1, 1, 'random', '[\"هر نیمه ۶ دقیقه\", \"وقت اضافه و پنالتی فعال\", \"انتخاب تیم آزاد\"]', '{\"extraTime\": true, \"penalties\": true, \"halfMinutes\": 6}', '{\"win\": 3, \"draw\": 1, \"loss\": 0}', NULL, NULL, '{\"first\": 10000000}', 'linear-gradient(135deg,#0d7c47,#0b1118 58%,#d4a11f)', 1, '2026-07-07 17:27:24', NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(2, 'c81c2f23-7a0b-11f1-974d-482ae3135c88', 'backgammon-seven-point-summer', 'کاپ هفت‌امتیازی تخته‌نرد', NULL, 'مسابقه استاندارد هفت‌امتیازی با مرحله گروهی و حذفی.', 2, 2, 2, 'گروهی و سپس حذفی', 'INDIVIDUAL', 1, 40, 10, 500000, 'TOMAN', 'PUBLISHED', '2026-07-08 17:27:24', '2026-07-16 17:27:24', '2026-07-19 17:27:24', NULL, 45, 10, 'offer', 1, 0, 'seeded', '[\"تا ۷ امتیاز\", \"داور برای مراحل حساس\", \"Doubling Cube اختیاری\"]', '{\"mars\": true, \"doublingCube\": false, \"targetPoints\": 7}', '{\"win\": 3, \"loss\": 0}', NULL, NULL, '{\"first\": 15000000}', 'linear-gradient(135deg,#4b2f1c,#111827 55%,#d9a441)', 0, '2026-07-07 17:27:24', NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(3, 'c81c3100-7a0b-11f1-974d-482ae3135c88', 'fc26-duo-night', 'شب دونفره FC 26', NULL, 'لیگ تیمی دو در برابر دو با جدول زنده.', 1, 3, 1, 'لیگ دوره‌ای', 'TEAM', 2, 16, 4, 700000, 'TOMAN', 'RUNNING', '2026-06-17 17:27:24', '2026-07-05 17:27:24', '2026-07-07 17:27:24', NULL, 30, 10, 'manual', 0, 0, 'custom', '[\"هر تیم دو بازیکن\", \"برد ۳ امتیاز\", \"تفاضل گل معیار دوم\"]', '{\"halfMinutes\": 6}', '{\"win\": 3, \"draw\": 1, \"loss\": 0}', NULL, NULL, '{\"first\": 8000000}', 'linear-gradient(135deg,#14213d,#101319 58%,#1dbb72)', 0, '2026-07-07 17:27:24', NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(4, '6f8a100a-7d56-11f1-af2b-482ae3135c88', 'tournament-1783794390924', 'مسایقه تخته نرد ویژه', NULL, 'لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها، و شرایط سخت تایپ به پایان رسد و زمان مورد نیاز شامل حروفچینی دستاوردهای اصلی، و جوابگوی سوالات پیوسته اهل دنیای موجود طراحی اساسا مورد استفاده قرار گیرد.لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها، و شرایط سخت تایپ به پایان رسد و زمان مورد نیاز شامل حروفچینی دستاوردهای اصلی، و جوابگوی سوالات پیوسته اهل دنیای موجود طراحی اساسا مورد استفاده قرار گیرد.لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها، و شرایط سخت تایپ به پایان رسد و زمان مورد نیاز شامل حروفچینی دستاوردهای اصلی، و جوابگوی سوالات پیوسته اهل دنیای موجود طراحی اساسا مورد استفاده قرار گیرد.لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که تمام و دشواری موجود در ارائه راهکارها، و شرایط سخت تایپ به پایان رسد و زمان مورد نیاز شامل حروفچینی دستاوردهای اصلی، و جوابگوی سوالات پیوسته اهل دنیای موجود طراحی اساسا مورد استفاده قرار گیرد.', 2, NULL, 2, 'حذفی تک‌بازی', 'INDIVIDUAL', 1, 32, 2, 350000, 'TOMAN', 'REGISTRATION_OPEN', NULL, NULL, '2026-07-12 21:56:00', NULL, 30, 10, 'offer', 1, 1, 'random', '[\"۱. هر بازیکن ۱۵ مهره دارد و باید همه مهره‌های خود را زودتر از حریف از صفحه خارج کند.\", \"۲. حرکت مهره‌ها بر اساس عدد دو تاس انجام می‌شود.\", \"۳. بازیکن باید در صورت امکان، هر دو عدد تاس را بازی کند.\", \"۴. در صورت جفت آمدن تاس، عدد تاس چهار بار بازی می‌شود.\", \"۵. مهره فقط می‌تواند روی خانه خالی، خانه دارای مهره خودی یا خانه‌ای با یک مهره حریف قرار بگیرد.\", \"۶. اگر روی یک خانه فقط یک مهره حریف باشد، آن مهره زده شده و به بار منتقل می‌شود.\", \"۷. بازیکنی که مهره در بار دارد، ابتدا باید آن مهره را وارد زمین کند و تا قبل از آن اجازه حرکت مهره‌های دیگر را ندارد.\"]', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-07-11 21:59:21', NULL, '2026-07-11 21:59:21', '2026-07-11 21:59:21'),
(5, '0a26237f-7de1-11f1-8c9d-482ae3135c88', 'tournament-1783853952160', 'iuhytj', NULL, NULL, 2, NULL, 1, 'حذفی تک‌بازی', 'INDIVIDUAL', 1, 32, 2, 350000, 'TOMAN', 'REGISTRATION_OPEN', NULL, NULL, '2026-07-13 14:29:00', NULL, 30, 10, 'automatic', 1, 0, 'random', '[\"fsjdgfojdsoigjds\", \"fdgopfdkgdktret\", \"etpohktroihjtrh\", \"trhtr\"]', NULL, NULL, NULL, NULL, NULL, NULL, 0, '2026-07-12 14:31:31', NULL, '2026-07-12 14:31:31', '2026-07-12 14:31:31');

-- --------------------------------------------------------

--
-- Table structure for table `tournament_matches`
--

DROP TABLE IF EXISTS `tournament_matches`;
CREATE TABLE IF NOT EXISTS `tournament_matches` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tournament_id` bigint UNSIGNED NOT NULL,
  `round_id` bigint UNSIGNED DEFAULT NULL,
  `resource_id` int UNSIGNED DEFAULT NULL,
  `match_number` int NOT NULL,
  `status` enum('PENDING','READY','LIVE','COMPLETED','POSTPONED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `scheduled_at` datetime DEFAULT NULL,
  `started_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `duration_min` int DEFAULT NULL,
  `home_score` int DEFAULT NULL,
  `away_score` int DEFAULT NULL,
  `result_data` json DEFAULT NULL,
  `winner_slot` int DEFAULT NULL,
  `referee_user_id` bigint UNSIGNED DEFAULT NULL,
  `notes` varchar(1000) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_matches_public_id` (`public_id`),
  UNIQUE KEY `uq_match_number` (`tournament_id`,`match_number`),
  KEY `idx_matches_status_date` (`tournament_id`,`status`,`scheduled_at`),
  KEY `fk_matches_round` (`round_id`),
  KEY `fk_matches_resource` (`resource_id`),
  KEY `fk_matches_referee` (`referee_user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tournament_matches`
--

INSERT INTO `tournament_matches` (`id`, `public_id`, `tournament_id`, `round_id`, `resource_id`, `match_number`, `status`, `scheduled_at`, `started_at`, `completed_at`, `duration_min`, `home_score`, `away_score`, `result_data`, `winner_slot`, `referee_user_id`, `notes`) VALUES
(1, 'c82a4acc-7a0b-11f1-974d-482ae3135c88', 3, 1, 3, 101, 'LIVE', '2026-07-07 17:27:24', '2026-07-07 17:27:24', NULL, NULL, 2, 1, NULL, NULL, NULL, NULL),
(2, 'c82a4ddd-7a0b-11f1-974d-482ae3135c88', 3, 1, 6, 102, 'LIVE', '2026-07-07 17:27:24', '2026-07-07 17:27:24', NULL, NULL, 0, 0, NULL, NULL, NULL, NULL),
(3, 'c82a4f43-7a0b-11f1-974d-482ae3135c88', 3, 1, 2, 103, 'READY', '2026-07-07 17:57:24', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tournament_rounds`
--

DROP TABLE IF EXISTS `tournament_rounds`;
CREATE TABLE IF NOT EXISTS `tournament_rounds` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `tournament_id` bigint UNSIGNED NOT NULL,
  `title` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `round_number` int NOT NULL,
  `stage` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `starts_at` datetime DEFAULT NULL,
  `configuration` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_round` (`tournament_id`,`round_number`,`stage`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tournament_rounds`
--

INSERT INTO `tournament_rounds` (`id`, `tournament_id`, `title`, `round_number`, `stage`, `starts_at`, `configuration`) VALUES
(1, 3, 'هفته سوم', 3, 'league', '2026-07-07 17:27:24', NULL),
(2, 1, 'دور اول', 1, 'knockout', '2026-07-14 17:27:24', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `tournament_sponsors`
--

DROP TABLE IF EXISTS `tournament_sponsors`;
CREATE TABLE IF NOT EXISTS `tournament_sponsors` (
  `tournament_id` bigint UNSIGNED NOT NULL,
  `sponsor_id` bigint UNSIGNED NOT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`tournament_id`,`sponsor_id`),
  KEY `fk_tournament_sponsors_sponsor` (`sponsor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tournament_templates`
--

DROP TABLE IF EXISTS `tournament_templates`;
CREATE TABLE IF NOT EXISTS `tournament_templates` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `game_id` int UNSIGNED NOT NULL,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `configuration` json NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` bigint UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_templates_game` (`game_id`,`is_active`),
  KEY `fk_templates_creator` (`created_by`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `tournament_templates`
--

INSERT INTO `tournament_templates` (`id`, `game_id`, `title`, `description`, `configuration`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'جام هفتگی FC 26', 'قالب حذفی ۳۲ نفره', '{\"format\": \"single_elimination\", \"capacity\": 32, \"drawMode\": \"random\", \"teamSize\": 1, \"halfMinutes\": 6, \"lateToleranceMin\": 10}', 1, NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(2, 2, 'تخته‌نرد هفت‌امتیازی', 'قالب گروهی و حذفی', '{\"format\": \"groups_knockout\", \"capacity\": 40, \"drawMode\": \"seeded\", \"targetPoints\": 7, \"lateToleranceMin\": 10}', 1, NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(3, 1, 'لیگ تیمی 2vs2', 'قالب لیگ دوره‌ای تیمی', '{\"format\": \"round_robin\", \"capacity\": 16, \"teamSize\": 2, \"winPoints\": 3, \"drawPoints\": 1}', 1, NULL, '2026-07-07 17:27:24', '2026-07-07 17:27:24'),
(4, 2, 'قالب مسایقه تخته نرد ویژه', 'لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف بهبود ابزارهای کاربردی می باشد، کتابهای زیادی در شصت و سه درصد گذشته حال و آینده، شناخت فراوان جامعه و متخصصان را می طلبد، تا با نرم افزارها شناخت بیشتری را برای طراحان رایانه ای علی الخصوص طراحان خلاقی، و فرهنگ پیشرو در زبان فارسی ایجاد کرد، در این صورت می توان امید داشت که', '{\"price\": 350000, \"rules\": [\"۱. هر بازیکن ۱۵ مهره دارد و باید همه مهره‌های خود را زودتر از حریف از صفحه خارج کند.\", \"۲. حرکت مهره‌ها بر اساس عدد دو تاس انجام می‌شود.\", \"۳. بازیکن باید در صورت امکان، هر دو عدد تاس را بازی کند.\", \"۴. در صورت جفت آمدن تاس، عدد تاس چهار بار بازی می‌شود.\", \"۵. مهره فقط می‌تواند روی خانه خالی، خانه دارای مهره خودی یا خانه‌ای با یک مهره حریف قرار بگیرد.\", \"۶. اگر روی یک خانه فقط یک مهره حریف باشد، آن مهره زده شده و به بار منتقل می‌شود.\", \"۷. بازیکنی که مهره در بار دارد، ابتدا باید آن مهره را وارد زمین کند و تا قبل از آن اجازه حرکت مهره‌های دیگر را ندارد.\"], \"format\": \"حذفی تک‌بازی\", \"capacity\": 32, \"drawMode\": \"random\", \"teamSize\": 1, \"waitlistMode\": \"offer\", \"hasThirdPlace\": true, \"allowMultiSlot\": true, \"participantType\": \"INDIVIDUAL\", \"lateToleranceMin\": 10, \"reservationExpiresMin\": 30}', 1, NULL, '2026-07-11 21:59:21', '2026-07-11 21:59:21'),
(5, 2, 'قالب iuhytj', NULL, '{\"price\": 350000, \"rules\": [\"fsjdgfojdsoigjds\", \"fdgopfdkgdktret\", \"etpohktroihjtrh\", \"trhtr\"], \"format\": \"حذفی تک‌بازی\", \"capacity\": 32, \"drawMode\": \"random\", \"teamSize\": 1, \"waitlistMode\": \"automatic\", \"hasThirdPlace\": false, \"allowMultiSlot\": true, \"participantType\": \"INDIVIDUAL\", \"lateToleranceMin\": 10, \"reservationExpiresMin\": 30}', 1, NULL, '2026-07-12 14:31:31', '2026-07-12 14:31:31');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `public_id` char(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `mobile` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(190) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `avatar_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nickname` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('ACTIVE','PENDING','SUSPENDED','DELETED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE',
  `mobile_verified` tinyint(1) NOT NULL DEFAULT '0',
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `two_factor_enabled` tinyint(1) NOT NULL DEFAULT '0',
  `two_step_code_hash` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `two_step_development_code` char(6) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `two_step_expires_at` datetime DEFAULT NULL,
  `two_step_attempts` int NOT NULL DEFAULT '0',
  `two_step_requested_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_public_id` (`public_id`),
  UNIQUE KEY `uq_users_mobile` (`mobile`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_status` (`status`,`deleted_at`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `public_id`, `name`, `mobile`, `email`, `password_hash`, `avatar_url`, `nickname`, `status`, `mobile_verified`, `email_verified`, `two_factor_enabled`, `deleted_at`, `created_at`, `updated_at`) VALUES
(5, '8fa2cde8-7f96-11f1-8c9d-482ae3135c88', 'amin vosta', '09901559940', 'Aminvost@gmail.com', '$2b$12$buE3UaYNDmMRazQYAsSE7OycZqDkswgYh3CBVTOnupRwLYTNcHzia', NULL, NULL, 'ACTIVE', 0, 0, 0, NULL, '2026-07-14 18:43:25', '2026-07-14 18:43:25'),
(6, '9b852532-7f97-11f1-8c9d-482ae3135c88', 'ali almasi', '09112222222', NULL, NULL, NULL, NULL, 'ACTIVE', 1, 0, 0, NULL, '2026-07-14 18:50:55', '2026-07-14 18:50:55'),
(7, '3465f9a9-7f98-11f1-8c9d-482ae3135c88', 'ali anbir', '09131234567', NULL, NULL, NULL, NULL, 'ACTIVE', 1, 0, 0, NULL, '2026-07-14 18:55:11', '2026-07-14 18:55:11');

-- --------------------------------------------------------

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` bigint UNSIGNED NOT NULL,
  `role_id` int UNSIGNED NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `fk_user_roles_role` (`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_roles`
--

INSERT INTO `user_roles` (`user_id`, `role_id`, `created_at`) VALUES
(5, 1, '2026-07-14 18:43:25'),
(6, 7, '2026-07-14 18:50:55'),
(7, 7, '2026-07-14 18:55:11');

-- --------------------------------------------------------

--
-- Table structure for table `venues`
--

DROP TABLE IF EXISTS `venues`;
CREATE TABLE IF NOT EXISTS `venues` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` varchar(160) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'internal',
  `address` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `map_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(30) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `directions` text COLLATE utf8mb4_unicode_ci,
  `image_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `venues`
--

INSERT INTO `venues` (`id`, `title`, `type`, `address`, `map_url`, `phone`, `directions`, `image_url`, `is_active`) VALUES
(1, 'Coffee Game ستارخان', 'internal', 'تهران، ستارخان - آدرس دقیق را از پنل ویرایش کنید', NULL, '02100000000', 'لوکیشن نقشه را از پنل تنظیم کنید', NULL, 1),
(2, 'سالن رویداد آریا', 'external', 'تهران - آدرس نمونه', NULL, NULL, 'اطلاعات نمونه برای مسابقه خارج مجموعه', NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `waitlist_entries`
--

DROP TABLE IF EXISTS `waitlist_entries`;
CREATE TABLE IF NOT EXISTS `waitlist_entries` (
  `id` bigint UNSIGNED NOT NULL AUTO_INCREMENT,
  `registration_id` bigint UNSIGNED NOT NULL,
  `position` int NOT NULL,
  `offered_at` datetime DEFAULT NULL,
  `offer_expires_at` datetime DEFAULT NULL,
  `accepted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_waitlist_registration` (`registration_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `discounts`
--
ALTER TABLE `discounts`
  ADD CONSTRAINT `fk_discounts_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `discount_usages`
--
ALTER TABLE `discount_usages`
  ADD CONSTRAINT `fk_discount_usages_discount` FOREIGN KEY (`discount_id`) REFERENCES `discounts` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_discount_usages_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_discount_usages_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `match_disputes`
--
ALTER TABLE `match_disputes`
  ADD CONSTRAINT `fk_disputes_match` FOREIGN KEY (`match_id`) REFERENCES `tournament_matches` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_disputes_resolver` FOREIGN KEY (`resolved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_disputes_submitter` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `match_participants`
--
ALTER TABLE `match_participants`
  ADD CONSTRAINT `fk_match_participants_match` FOREIGN KEY (`match_id`) REFERENCES `tournament_matches` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_match_participants_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_match_participants_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_payments_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_payments_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_payments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payment_receipts`
--
ALTER TABLE `payment_receipts`
  ADD CONSTRAINT `fk_receipts_payment` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `players`
--
ALTER TABLE `players`
  ADD CONSTRAINT `fk_players_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `ranking_boards`
--
ALTER TABLE `ranking_boards`
  ADD CONSTRAINT `fk_ranking_boards_game` FOREIGN KEY (`game_id`) REFERENCES `games` (`id`);

--
-- Constraints for table `ranking_entries`
--
ALTER TABLE `ranking_entries`
  ADD CONSTRAINT `fk_ranking_entries_board` FOREIGN KEY (`board_id`) REFERENCES `ranking_boards` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ranking_entries_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `registrations`
--
ALTER TABLE `registrations`
  ADD CONSTRAINT `fk_registrations_buyer` FOREIGN KEY (`buyer_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_registrations_source_hold` FOREIGN KEY (`source_hold_id`) REFERENCES `registration_holds` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_registrations_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `registration_entries`
--
ALTER TABLE `registration_entries`
  ADD CONSTRAINT `fk_entries_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_entries_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_entries_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `registration_holds`
--
ALTER TABLE `registration_holds`
  ADD CONSTRAINT `fk_registration_holds_registration` FOREIGN KEY (`converted_registration_id`) REFERENCES `registrations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_registration_holds_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_registration_holds_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `resources`
--
ALTER TABLE `resources`
  ADD CONSTRAINT `fk_resources_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD CONSTRAINT `fk_role_permissions_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_role_permissions_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sessions`
--
ALTER TABLE `sessions`
  ADD CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `teams`
--
ALTER TABLE `teams`
  ADD CONSTRAINT `fk_teams_creator` FOREIGN KEY (`created_by_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `team_members`
--
ALTER TABLE `team_members`
  ADD CONSTRAINT `fk_team_members_player` FOREIGN KEY (`player_id`) REFERENCES `players` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_team_members_team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tournaments`
--
ALTER TABLE `tournaments`
  ADD CONSTRAINT `fk_tournaments_game` FOREIGN KEY (`game_id`) REFERENCES `games` (`id`),
  ADD CONSTRAINT `fk_tournaments_template` FOREIGN KEY (`template_id`) REFERENCES `tournament_templates` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_tournaments_venue` FOREIGN KEY (`venue_id`) REFERENCES `venues` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `tournament_matches`
--
ALTER TABLE `tournament_matches`
  ADD CONSTRAINT `fk_matches_referee` FOREIGN KEY (`referee_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_matches_resource` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_matches_round` FOREIGN KEY (`round_id`) REFERENCES `tournament_rounds` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_matches_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tournament_rounds`
--
ALTER TABLE `tournament_rounds`
  ADD CONSTRAINT `fk_rounds_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tournament_sponsors`
--
ALTER TABLE `tournament_sponsors`
  ADD CONSTRAINT `fk_tournament_sponsors_sponsor` FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_tournament_sponsors_tournament` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `tournament_templates`
--
ALTER TABLE `tournament_templates`
  ADD CONSTRAINT `fk_templates_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_templates_game` FOREIGN KEY (`game_id`) REFERENCES `games` (`id`);

--
-- Constraints for table `user_roles`
--
ALTER TABLE `user_roles`
  ADD CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `waitlist_entries`
--
ALTER TABLE `waitlist_entries`
  ADD CONSTRAINT `fk_waitlist_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

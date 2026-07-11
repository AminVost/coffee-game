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
(13,'audit.view','مشاهده تاریخچه','system'),(14,'checkin.manage','مدیریت حضور','registrations');
INSERT INTO `role_permissions` (`role_id`,`permission_id`) SELECT 1,id FROM permissions;
INSERT INTO `role_permissions` VALUES (2,1),(2,2),(2,3),(2,4),(2,5),(2,6),(2,7),(2,8),(2,9),(2,11),(2,13),(2,14),(3,1),(3,4),(3,5),(3,6),(3,14),(4,1),(4,5),(4,6),(5,7),(5,8),(6,11),(7,1);

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

import type { AdminStat, LiveMatch, RankingRow, Tournament } from "@/types";

export const tournaments: Tournament[] = [
  {
    id: "t-001",
    slug: "fc26-friday-cup-01",
    title: "جام جمعه FC 26",
    game: "fc26",
    gameTitle: "FC 26 روی PS5",
    format: "حذفی تک‌بازی",
    participantMode: "انفرادی 1vs1",
    status: "ثبت‌نام باز",
    date: "جمعه ۲۶ تیر ۱۴۰۵",
    time: "ساعت ۱۸:۰۰",
    venue: "Coffee Game ستارخان",
    venueType: "internal",
    capacity: 32,
    registered: 24,
    price: 350000,
    prize: "۱۰,۰۰۰,۰۰۰ تومان",
    cover: "linear-gradient(135deg,#0d7c47,#0b1118 58%,#d4a11f)",
    featured: true,
    description: "جام سریع و هیجان‌انگیز FC 26 با قرعه‌کشی زنده، زمان‌بندی خودکار و نمایش نتایج لحظه‌ای.",
    rules: ["مدت هر نیمه ۶ دقیقه", "وقت اضافه و پنالتی فعال", "انتخاب تیم آزاد", "۱۰ دقیقه مهلت حضور"],
    tags: ["PS5", "1vs1", "جایزه نقدی"]
  },
  {
    id: "t-002",
    slug: "backgammon-seven-point-summer",
    title: "کاپ هفت‌امتیازی تخته‌نرد",
    game: "backgammon",
    gameTitle: "تخته‌نرد",
    format: "گروهی و سپس حذفی",
    participantMode: "انفرادی",
    status: "به‌زودی",
    date: "پنجشنبه ۱ مرداد ۱۴۰۵",
    time: "ساعت ۱۷:۰۰",
    venue: "سالن رویداد آریا",
    venueType: "external",
    capacity: 40,
    registered: 17,
    price: 500000,
    prize: "۱۵,۰۰۰,۰۰۰ تومان",
    cover: "linear-gradient(135deg,#4b2f1c,#111827 55%,#d9a441)",
    description: "مسابقه استاندارد هفت‌امتیازی با داوری رسمی، مرحله گروهی و جدول حذفی نهایی.",
    rules: ["مسابقه تا ۷ امتیاز", "داور برای مراحل حساس", "Doubling Cube اختیاری", "قرعه‌کشی Seed شده"],
    tags: ["هفت امتیازی", "تخته‌نرد", "گروهی"]
  },
  {
    id: "t-003",
    slug: "fc26-duo-night",
    title: "شب دونفره FC 26",
    game: "fc26",
    gameTitle: "FC 26 روی PS5",
    format: "لیگ دوره‌ای",
    participantMode: "تیمی 2vs2",
    status: "در حال برگزاری",
    date: "سه‌شنبه ۲۳ تیر ۱۴۰۵",
    time: "ساعت ۲۰:۰۰",
    venue: "Coffee Game ستارخان",
    venueType: "internal",
    capacity: 16,
    registered: 16,
    price: 700000,
    prize: "۸,۰۰۰,۰۰۰ تومان",
    cover: "linear-gradient(135deg,#14213d,#101319 58%,#1dbb72)",
    description: "لیگ تیمی چهارنفره با کاپیتان اختیاری و جدول امتیازات زنده.",
    rules: ["هر تیم دو بازیکن", "برد ۳ امتیاز", "تساوی ۱ امتیاز", "تفاضل گل معیار دوم"],
    tags: ["2vs2", "لیگ", "زنده"]
  },
  {
    id: "t-004",
    slug: "backgammon-weekly-rapid",
    title: "تخته‌نرد هفتگی سریع",
    game: "backgammon",
    gameTitle: "تخته‌نرد",
    format: "حذفی تک‌بازی",
    participantMode: "انفرادی",
    status: "پایان‌یافته",
    date: "جمعه ۱۹ تیر ۱۴۰۵",
    time: "ساعت ۱۶:۰۰",
    venue: "Coffee Game ستارخان",
    venueType: "internal",
    capacity: 16,
    registered: 16,
    price: 250000,
    prize: "۵,۰۰۰,۰۰۰ تومان",
    cover: "linear-gradient(135deg,#2a1b3d,#101319 60%,#d4a11f)",
    description: "مسابقه هفتگی کوتاه برای ثبت رکورد و افزایش امتیاز رنکینگ.",
    rules: ["تا ۵ امتیاز", "حذفی مستقیم", "رده‌بندی مقام سوم", "نتایج ثبت‌شده توسط داور"],
    tags: ["هفتگی", "سریع", "رنکینگ"]
  }
];

export const liveMatches: LiveMatch[] = [
  { id: "m-101", tournament: "شب دونفره FC 26", round: "هفته سوم", resource: "PS5 شماره ۳", status: "LIVE", home: "تیم شاهین", away: "تیم آلفا", homeScore: 2, awayScore: 1, startsAt: "اکنون" },
  { id: "m-102", tournament: "شب دونفره FC 26", round: "هفته سوم", resource: "PS5 شماره ۶", status: "LIVE", home: "تیم نارنجی", away: "تیم کافه", homeScore: 0, awayScore: 0, startsAt: "اکنون" },
  { id: "m-103", tournament: "شب دونفره FC 26", round: "هفته سوم", resource: "PS5 شماره ۲", status: "NEXT", home: "تیم توربو", away: "تیم نایت", startsAt: "۲۱:۱۵" },
  { id: "m-104", tournament: "کاپ تخته‌نرد سریع", round: "نیمه‌نهایی", resource: "میز شماره ۱", status: "DONE", home: "میلاد زمانی", away: "آرمان رستمی", homeScore: 7, awayScore: 4, startsAt: "پایان‌یافته" }
];

export const fcRankings: RankingRow[] = [
  { rank: 1, name: "امیرحسین رضایی", avatar: "ا", played: 18, wins: 14, points: 1260, trend: 2 },
  { rank: 2, name: "مهدی کریمی", avatar: "م", played: 21, wins: 15, points: 1215, trend: -1 },
  { rank: 3, name: "کیان فرهمند", avatar: "ک", played: 17, wins: 12, points: 1180, trend: 1 },
  { rank: 4, name: "عرفان نادری", avatar: "ع", played: 20, wins: 13, points: 1142, trend: 0 },
  { rank: 5, name: "سینا محسنی", avatar: "س", played: 16, wins: 10, points: 1098, trend: 3 }
];

export const backgammonRankings: RankingRow[] = [
  { rank: 1, name: "فرهاد کاظمی", avatar: "ف", played: 14, wins: 11, points: 980, trend: 0 },
  { rank: 2, name: "بابک احمدی", avatar: "ب", played: 16, wins: 12, points: 954, trend: 2 },
  { rank: 3, name: "پویا نظری", avatar: "پ", played: 12, wins: 9, points: 901, trend: -1 },
  { rank: 4, name: "سعید موسوی", avatar: "س", played: 15, wins: 10, points: 875, trend: 1 },
  { rank: 5, name: "محمد شریفی", avatar: "م", played: 11, wins: 7, points: 820, trend: 0 }
];

export const adminStats: AdminStat[] = [
  { title: "مسابقات فعال", value: "۶", hint: "۲ مسابقه در حال اجرا", trend: "+۲ این ماه" },
  { title: "ثبت‌نام‌های ماه", value: "۱۸۷", hint: "۲۴ نفر در انتظار پرداخت", trend: "+۱۸٪" },
  { title: "درآمد تاییدشده", value: "۶۸.۴ م", hint: "تومان", trend: "+۱۲٪" },
  { title: "کاربران فعال", value: "۴۳۲", hint: "۳۶ کاربر جدید", trend: "+۹٪" }
];

export const recentRegistrations = [
  { name: "علی مرادی", tournament: "جام جمعه FC 26", status: "تاییدشده", amount: "۳۵۰,۰۰۰" },
  { name: "تیم توربو", tournament: "شب دونفره FC 26", status: "پرداخت حضوری", amount: "۷۰۰,۰۰۰" },
  { name: "سجاد حیدری", tournament: "کاپ هفت‌امتیازی", status: "در انتظار فیش", amount: "۵۰۰,۰۰۰" },
  { name: "پرهام یوسفی", tournament: "جام جمعه FC 26", status: "لیست انتظار", amount: "۳۵۰,۰۰۰" }
];

export const adminNavigation = [
  { href: "/admin", label: "داشبورد", icon: "LayoutDashboard" },
  { href: "/admin/tournaments", label: "مسابقات", icon: "Trophy" },
  { href: "/admin/templates", label: "قالب‌های مسابقه", icon: "CopyPlus" },
  { href: "/admin/players", label: "بازیکنان", icon: "Contact" },
  { href: "/admin/participants", label: "شرکت‌کنندگان و حضور", icon: "Users" },
  { href: "/admin/matches", label: "بازی‌ها و نتایج", icon: "Swords" },
  { href: "/admin/payments", label: "پرداخت‌ها", icon: "WalletCards" },
  { href: "/admin/content", label: "محتوا و گالری", icon: "Images" },
  { href: "/admin/settings", label: "تنظیمات", icon: "Settings" }
];

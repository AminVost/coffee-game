# وضعیت پیاده‌سازی

## آماده و قابل تست

- UI عمومی، پنل کاربر و پنل مدیریت
- Responsive، RTL، Dark/Light و PWA
- Mock Data و Login Mock
- اتصال MySQL با mysql2 و Query پارامتری
- SQL کامل و Seed
- API ورود، ثبت‌نام، مسابقه، رزرو، قالب و آپلود فیش
- چند سهم، تیم، لیست انتظار، منابع، نتایج و رنکینگ در مدل داده
- Build Production و ESLint بدون خطا

## نیازمند کلید یا تصمیم نهایی پیش از Production

- ارسال واقعی SMS.ir
- Google OAuth واقعی
- زرین‌پال یا درگاه مستقیم
- Google Authenticator واقعی
- Socket.IO/SSE برای Push لحظه‌ای؛ endpoint فعلی Live آماده Polling است
- موتور کامل تولید Bracket برای همه شش فرمت
- QR Scanner دوربین موبایل
- Backup و Object Storage محیط سرور

این موارد وابسته به Credential، قرارداد سرویس یا تست حضوری مجموعه هستند و در نسخه محلی به‌صورت Mock/ساختار آماده نگه داشته شده‌اند.

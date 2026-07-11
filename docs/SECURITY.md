# امنیت

موارد پیاده‌سازی‌شده یا در ساختار دیتابیس:

- Session امضاشده در Cookie با `HttpOnly` و `SameSite=Lax`
- Cookie امن در Production
- Hash رمز با bcrypt
- Queryهای پارامتری MySQL
- Role/Permission و محدودیت مسیر مدیریت
- Soft Delete برای داده‌های کلیدی
- Audit Log با نگهداری پیشنهادی ۹۰ روز
- محدودیت نوع و حجم فایل فیش
- عدم قرار دادن Secret در Frontend
- جلوگیری از ثبت شماره تکراری در یک مسابقه

موارد لازم پیش از انتشار عمومی:

- HTTPS و Reverse Proxy استاندارد
- Rate Limit سراسری و محدودیت Login/OTP
- CSRF Token برای عملیات حساس
- سرویس واقعی Email/SMS و محدودیت ارسال
- آنتی‌ویروس یا Object Storage برای آپلودها
- Backup روزانه دیتابیس
- Google Authenticator واقعی با Recovery Code
- تست نفوذ و بازبینی Permissionها

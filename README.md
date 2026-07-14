# Coffee Game Satarkhan

سامانه مدیریت مسابقات، ثبت‌نام، رزرو موقت ظرفیت، پرداخت دستی، پیگیری عمومی، قرعه، مسابقات زنده و رنکینگ.

## وضعیت داده

تمام جریان‌های عملیاتی برنامه به MySQL متصل هستند. حالت داده Mock در Runtime وجود ندارد. اطلاعات مسابقات، کاربران، پرداخت‌ها، ثبت‌نام‌ها، صفحات محتوا، اخبار، گالری، رنکینگ، قرعه و داشبوردها از دیتابیس خوانده می‌شوند.

## نصب

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

دیتابیس نصب تازه:

```text
database/coffee_game_satarkhan.sql
```

برای دیتابیس فعلی، Migration جدید را فقط یک بار Import کنید:

```text
database/migrations/20260714_production_otp_dynamic_cleanup.sql
```

## ورود پیامکی قبل از دریافت حساب SMS.ir

در محیط Local این تنظیمات قابل استفاده‌اند:

```env
SMS_PROVIDER=database
ALLOW_DATABASE_OTP=true
```

در این حالت:

- با درخواست OTP، کاربر فوراً در جدول `users` با وضعیت `PENDING` ساخته می‌شود.
- هش کد در `users.two_step_code_hash` و `otp_codes.code_hash` ذخیره می‌شود.
- کد موقت فقط برای توسعه در `users.two_step_development_code` ثبت می‌شود.
- کد در پاسخ API یا رابط کاربری نمایش داده نمی‌شود.
- پس از تأیید یا انقضا، کد قابل‌خواندن پاک می‌شود.

برای دیدن کد در محیط Local:

```sql
SELECT id,name,mobile,status,two_step_development_code,two_step_expires_at
FROM users
WHERE mobile='09123456789'
LIMIT 1;
```

این روش در `NODE_ENV=production` غیرفعال است. برای Production:

```env
SMS_PROVIDER=smsir
ALLOW_DATABASE_OTP=false
SMSIR_API_KEY=...
SMSIR_TEMPLATE_ID=...
```

## الزامات Production

```env
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/coffee_game_satarkhan
AUTH_SECRET=RANDOM_SECRET_WITH_AT_LEAST_32_CHARACTERS
NEXT_PUBLIC_APP_URL=https://example.com
SMS_PROVIDER=smsir
ALLOW_DATABASE_OTP=false
```

برنامه در Production بدون `AUTH_SECRET` معتبر، Session ایجاد یا بررسی نمی‌کند. ورود OTP دیتابیسی نیز در Production پذیرفته نمی‌شود.

## جریان ثبت‌نام و پرداخت

1. اطلاعات شرکت‌کنندگان داخل صفحه مسابقه دریافت می‌شود.
2. کاربر ناشناس همان‌جا با OTP وارد می‌شود.
3. ظرفیت به مدت ۱۵ دقیقه Hold می‌شود.
4. اطلاعات انتقال بانکی، کارتخوان یا نقدی ثبت می‌شود.
5. پرداخت در صندوق مدیریت بررسی می‌شود.
6. مدیر می‌تواند پرداخت `PENDING` یا `NEEDS_CORRECTION` را تأیید، نیازمند اصلاح یا رد نهایی کند.
7. کاربر از حساب یا لینک عمومی امن، وضعیت ثبت‌نام را پیگیری می‌کند.

## بررسی‌ها

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

# Coffee Game Satarkhan

وب‌اپلیکیشن فارسی و RTL برای رزرو و مدیریت مسابقات FC 26 و تخته‌نرد، با طراحی Mobile First، پنل مدیریت، پنل بازیکن، حالت Dark/Light، PWA و دیتابیس MySQL قابل Import در phpMyAdmin.

## امکانات موجود در این نسخه

- صفحه اصلی مدرن و Responsive
- فهرست و جزئیات مسابقات
- ثبت‌نام چندسهمی و ثبت مهمان
- مسابقات انفرادی و تیمی
- نمایش نتایج و برنامه زنده
- رنکینگ مستقل FC 26 و تخته‌نرد
- پنل بازیکن، تیم‌ها، پرداخت‌ها و اعلان‌ها
- پنل مدیریت مسابقات، شرکت‌کنندگان، نتایج، پرداخت‌ها و محتوا
- Wizard ساخت مسابقه
- قالب‌های ذخیره‌شده مسابقه
- ورود با رمز و SMS Mock
- ساختار آماده Google Login، SMS.ir و زرین‌پال در `.env`
- آپلود امن اولیه فیش JPG/PNG/PDF تا ۵ مگابایت
- MySQL با نقش‌ها، Permission، Audit Log، Soft Delete و داده‌های اولیه
- PWA و Service Worker برای نسخه Production

## حساب‌های آزمایشی

| نوع | نام کاربری | رمز |
|---|---|---|
| مدیر | `admin@coffeegame.local` | `Admin@123` |
| بازیکن | `player@coffeegame.local` | `Player@123` |
| ورود SMS Mock | هر موبایل معتبر | `123456` |

## اجرای سریع بدون دیتابیس

پیش‌نیاز: Node.js 20.9 یا جدیدتر.

```powershell
cd coffee-game-satarkhan
npm install
npm run dev
```

سپس باز کنید:

```text
http://localhost:3000
```

پروژه به‌صورت پیش‌فرض با `DATA_MODE=mock` اجرا می‌شود و MySQL لازم ندارد.

## اتصال به MySQL در WampServer

1. WampServer را اجرا و مطمئن شوید آیکون سبز است.
2. phpMyAdmin را باز کنید.
3. از تب Import فایل زیر را وارد کنید:

```text
database/coffee_game_satarkhan.sql
```

نسخه فشرده نیز آماده است:

```text
database/coffee_game_satarkhan.sql.gz
```

4. فایل `.env` را ویرایش کنید:

```env
DATA_MODE=mysql
DATABASE_URL="mysql://root:@127.0.0.1:3306/coffee_game_satarkhan"
```

5. سرور Dev را Restart کنید:

```powershell
Ctrl + C
npm run dev
```

## دستورهای مهم

```powershell
npm run dev      # اجرای توسعه
npm run build    # تست Build
npm run start    # اجرای Build تولیدی
npm run lint     # بررسی کد
```

## مسیرهای مهم

```text
/                       صفحه اصلی
/tournaments            مسابقات
/live                   نمایش زنده
/rankings               رنکینگ‌ها
/login                  ورود
/account                پنل بازیکن
/admin                  پنل مدیریت
/admin/tournaments/new  ساخت مسابقه
/admin/templates        قالب‌های مسابقه
/api/health             بررسی سلامت API
```

## تنظیم سرویس‌های واقعی

این نسخه برای جلوگیری از هزینه و وابستگی، با سرویس‌های Mock اجرا می‌شود. برای Production باید کلیدهای واقعی در `.env` قرار گیرند و Adapterهای مربوط فعال شوند:

```env
SMS_PROVIDER=smsir
SMSIR_API_KEY="..."
PAYMENT_PROVIDER=zarinpal
ZARINPAL_MERCHANT_ID="..."
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

کلیدها نباید داخل Git یا کد Frontend قرار بگیرند.

## ساختار پروژه

```text
src/app/                  صفحات و Route Handlerها
src/components/           کامپوننت‌های UI، عمومی و مدیریت
src/data/                 داده‌های Mock
src/lib/                  Session، MySQL و Repositoryها
database/                 فایل‌های SQL قابل Import
public/brand/             لوگو و Assetهای برند
docs/                     مستندات فنی و تست
storage/receipts/         فیش‌های محلی؛ در Git ذخیره نمی‌شوند
```

## نکته امنیتی

حساب‌ها و رمزهای نمونه فقط برای محیط Local هستند. پیش از انتشار عمومی، رمزها، `AUTH_SECRET`، تنظیمات CORS/Proxy، HTTPS، محدودیت درخواست‌ها، اسکن فایل و سرویس‌های واقعی باید تنظیم و تست شوند.

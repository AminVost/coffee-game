# راه‌اندازی روی WampServer64

## 1. بررسی سرویس‌ها

WampServer را اجرا کنید. MySQL و Apache باید فعال باشند. پروژه Next.js از Apache استفاده نمی‌کند و روی پورت 3000 اجرا می‌شود؛ Wamp فقط MySQL و phpMyAdmin را فراهم می‌کند.

## 2. Import دیتابیس

در phpMyAdmin:

1. روی Import کلیک کنید.
2. فایل `database/coffee_game_satarkhan.sql` را انتخاب کنید.
3. Character set را `utf-8` نگه دارید.
4. روی Import بزنید.

فایل خودش دیتابیس `coffee_game_satarkhan` را ایجاد می‌کند.

## 3. تنظیم اتصال

برای MySQL بدون رمز پیش‌فرض Wamp:

```env
DATABASE_URL="mysql://root:@127.0.0.1:3306/coffee_game_satarkhan"
```

در صورت داشتن رمز:

```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@127.0.0.1:3306/coffee_game_satarkhan"
```

اگر رمز دارای `@`, `#`, `%` یا کاراکتر خاص است باید URL Encode شود.

## 4. دسترسی از موبایل در شبکه داخلی

```powershell
ipconfig
npm run dev -- --hostname 0.0.0.0
```

سپس در موبایل متصل به همان Wi-Fi:

```text
http://IP-کامپیوتر:3000
```

در Windows Firewall اجازه دسترسی Node.js به Private Network را بدهید.

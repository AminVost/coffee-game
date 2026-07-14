# API خلاصه

## احراز هویت

| Method | Route | کاربرد |
|---|---|---|
| POST | `/api/auth/sms/request` | ایجاد/به‌روزرسانی کاربر PENDING و تولید OTP پویا |
| POST | `/api/auth/sms/verify` | تأیید OTP، فعال‌سازی حساب، اتصال داده‌های مهمان و ایجاد Session |
| POST | `/api/auth/login` | ورود با رمز |
| POST | `/api/auth/register` | ساخت حساب با رمز |

OTP هیچ‌گاه در پاسخ مرورگر ارسال نمی‌شود. ارائه‌دهنده `database` فقط برای Local است و در Production ممنوع است.

## ثبت‌نام و پرداخت

- `/api/registration-holds`
- `/api/registrations`
- `/api/account/payments`
- `/api/admin/payments`
- `/api/registration-track/[token]`

همه Routeها از MySQL استفاده می‌کنند و Routeهای خصوصی مالکیت یا Permission را کنترل می‌کنند.

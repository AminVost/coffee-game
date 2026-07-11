# API خلاصه

| Method | Route | توضیح |
|---|---|---|
| GET | `/api/health` | وضعیت سرویس و حالت داده |
| POST | `/api/auth/login` | ورود رمز |
| POST | `/api/auth/register` | ثبت‌نام کاربر |
| POST | `/api/auth/sms/request` | درخواست OTP Mock |
| POST | `/api/auth/sms/verify` | ورود با OTP Mock |
| GET/POST | `/api/tournaments` | فهرست/ساخت مسابقه |
| PATCH/DELETE | `/api/tournaments/:id` | ویرایش/Soft Delete |
| POST | `/api/registrations` | رزرو چندسهمی |
| GET | `/api/live` | بازی‌های زنده |
| GET/POST | `/api/admin/templates` | قالب‌های مسابقه |
| POST | `/api/payments/receipts` | آپلود فیش |

Routeهای مدیریت Session مدیر را بررسی می‌کنند. Queryهای MySQL پارامتری هستند.

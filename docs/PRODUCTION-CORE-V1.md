# Production Core v1

This patch hardens the existing application without adding SMS.ir credentials.

Implemented:
- MySQL/MariaDB-compatible incremental migrations
- token-only public registration tracking
- page-level admin permission checks
- runtime enforcement for payment methods and required admin OTP
- same-origin protection for unsafe API requests
- security response headers
- persistent database-backed rate limiting for password login
- validated receipt file signatures and private storage (existing behavior retained)
- scheduled maintenance endpoint for expired holds, registrations, OTPs, sessions and rate limits
- structured JSON logging helper
- database backup and maintenance scripts
- production environment validation additions

Required environment values:
- DATABASE_URL
- AUTH_SECRET (minimum 32 random characters in production)
- NEXT_PUBLIC_APP_URL
- MAINTENANCE_SECRET (minimum 32 random characters)
- SMS provider variables when SMS.ir is enabled

Schedule `scripts/run-maintenance.ps1` every 5-15 minutes and `scripts/backup-database.ps1` daily using Windows Task Scheduler or the hosting scheduler.

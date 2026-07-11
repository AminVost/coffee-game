# Critical Fixes V1

This patch replaces the critical mock/incomplete workflows that blocked safe MySQL testing.

## Registration integrity

- Capacity is calculated from active `registrations.slots`, including only unexpired reservations.
- Duplicate mobile numbers inside one request are rejected.
- Existing players are reused by mobile.
- MySQL advisory locks serialize player identity creation across registration, account creation, SMS login, and team creation.
- Existing participation in the same tournament is rejected.
- Team registrations consume one team slot while individual multi-entry registrations consume one slot per player.
- Waitlisted registrations do not create a payable payment record.

## Authentication and sessions

- MySQL SMS login uses generated, hashed, expiring, single-use OTP records.
- The fixed mock OTP is available only in mock, non-production mode.
- SMS requests have cooldown, hourly rate limiting, attempt limits, and expiry.
- Sessions are persisted in `sessions`, checked on every authenticated request, and can be revoked per device.
- Roles and permissions are loaded from the database on every session validation.

## Payments and receipts

- Receipt upload is tied to an existing payment and registration.
- JPG, PNG, and PDF signatures and a 5 MB limit are enforced.
- Upload updates the payment to pending and registration to pending approval.
- Authorized managers can view, approve, or reject receipts.

## Real database workflows

- Live matches are loaded from tournament, round, resource, participant, and result tables.
- Tournament and ranking filters execute real filtering.
- Result editing, check-in/no-show, content saving, settings saving, tournament creation, tournament templates, payment approval, and team creation call real APIs.
- Admin navigation is filtered by database permissions.

## Required setup

1. Apply `database/migrations/20260711_critical_security_and_workflows.sql`.
2. Copy new environment keys from `.env.example` to `.env`.
3. For real SMS set `SMS_PROVIDER=smsir`, `SMSIR_API_KEY`, and `SMSIR_TEMPLATE_ID`.
4. Restart the Next.js process after changing `.env`.

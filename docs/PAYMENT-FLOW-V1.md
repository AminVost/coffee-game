# Payment Flow V1

## User flow

1. The user selects one of these methods:
   - Card-to-card / bank transfer
   - In-person POS
   - In-person cash
2. For card transfer, these fields are required:
   - payer name
   - last four digits of payer card
   - bank tracking code
   - payment date
   - payment time (optional)
   - receipt image/PDF (optional)
3. The amount is calculated by the server and cannot be changed by the user.
4. Card transfers move the registration to `PENDING_APPROVAL`.
5. POS/cash reservations remain `PENDING_PAYMENT` until the cashier confirms them.

## Admin flow

- `/admin/payments` is the centralized payment inbox.
- Search supports participant name, mobile, payer, amount, bank tracking code, last four digits and internal payment reference.
- The bank tracking code can be copied for searching the bank SMS application.
- Approving a payment confirms the registration and its entries.
- Rejecting a payment returns the registration to `PENDING_PAYMENT` and stores the rejection reason.
- Capacity is checked again before approval to prevent overbooking.

## User account

- `/account/payments` shows payment status and bank-transfer details.
- A rejected or pending bank transfer can be corrected and resubmitted.
- The optional receipt can be added or replaced.
- Approval/rejection creates an in-app notification.

## SMS status notifications

Payment status SMS is optional. Configure SMS.ir templates in `.env`:

```env
SMSIR_PAYMENT_APPROVED_TEMPLATE_ID=0
SMSIR_PAYMENT_REJECTED_TEMPLATE_ID=0
```

Approved template parameter:

```text
Tournament
```

Rejected template parameters:

```text
Tournament
Reason
```

When the IDs are zero, payment processing continues normally and status SMS is skipped.

## Required migration

Import this file once for an existing database:

```text
database/migrations/20260714_payment_submission_flow.sql
```

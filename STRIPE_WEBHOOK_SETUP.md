# Stripe Webhook Setup - HeroKids

This guide shows how to configure Stripe webhooks to handle subscription payments asynchronously.

## Why Webhooks?

HeroKids uses **Replit Core** (Autoscale deployment), which means:
- ❌ Apps **sleep when idle** (no always-on)
- ✅ Webhooks are **free** and wake up the app automatically
- ✅ Stripe guarantees delivery with automatic retries

## Setup Instructions

### 1. Get Your Webhook Endpoint URL

Your webhook endpoint is:
```
https://herokids.replit.app/api/stripe/webhook
```

### 2. Configure in Stripe Dashboard

1. Go to **Stripe Dashboard** → [Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **"Add endpoint"**
3. Enter the endpoint URL:
   ```
   https://herokids.replit.app/api/stripe/webhook
   ```
4. Select events to listen to:
   - ✅ `checkout.session.completed` (required for subscription activation)
5. Click **"Add endpoint"**

### 3. Copy Webhook Signing Secret

After creating the endpoint:
1. Click on the new endpoint in the list
2. Find the **"Signing secret"** section
3. Click **"Reveal"** to show the secret
4. Copy the secret (starts with `whsec_...`)

### 4. Add Secret to Replit

1. In Replit, go to **Tools** → **Secrets** (or the 🔒 icon)
2. Add a new secret:
   - **Key**: `STRIPE_WEBHOOK_SECRET`
   - **Value**: Paste the signing secret from Stripe (e.g., `whsec_abc123...`)
3. Save the secret

### 5. Test the Webhook

1. **Trigger a test payment**:
   - Go to Settings → Upgrade
   - Click "Upgrade to Family"
   - Complete the Stripe checkout with test card: `4242 4242 4242 4242`

2. **Watch the webhook in action**:
   - In Stripe Dashboard → Webhooks → Your endpoint
   - You should see the `checkout.session.completed` event
   - Status should be **"Succeeded"** (200 response)

3. **Verify the subscription was activated**:
   - After payment, you'll see "Payment Processing..." dialog
   - After 5 seconds, the page auto-reloads
   - Your family tier should now be "FAMILY"

## How It Works

```
User clicks "Upgrade"
  ↓
Redirected to Stripe Checkout
  ↓
User completes payment
  ↓
Stripe sends webhook → /api/stripe/webhook
  ↓
App wakes up (if sleeping)
  ↓
Webhook updates family tier in database
  ↓
WebSocket broadcasts "subscription-updated"
  ↓
User redirected to /dashboard?subscription=success
  ↓
Dialog shows "Payment Processing..."
  ↓
After 5 seconds: Page reloads
  ↓
New tier is active! 🎉
```

## Webhook Event Handling

The webhook endpoint (`server/routes.ts`) handles:
- ✅ **Signature verification** (prevents fake webhook calls)
- ✅ **checkout.session.completed** → Updates family subscription tier
- ✅ **customer.subscription.deleted** → Downgrades to FREE tier
- ✅ **WebSocket broadcast** → Syncs UI across all family members
- ✅ **Error handling** → Logs errors, returns 500 status for Stripe retry

## Troubleshooting

### Webhook fails with "No signature found"
- ✅ Make sure `STRIPE_WEBHOOK_SECRET` is set in Replit Secrets
- ✅ Verify the secret starts with `whsec_`

### Webhook fails with "Invalid signature"
- ✅ Check if the secret matches the one in Stripe Dashboard
- ✅ Regenerate the secret in Stripe and update in Replit

### Subscription not activating
- ✅ Check webhook status in Stripe Dashboard → Webhooks
- ✅ Look for errors in the webhook response body
- ✅ Check Replit logs for error messages

### Test Mode vs Live Mode
- 🧪 **Test mode**: Use test cards (4242...) and test webhook secret
- 🚀 **Live mode**: Use real cards and live webhook secret
- ⚠️ **Important**: Test and live modes have **separate** webhook secrets!

## Security

✅ **Webhook signature verification** prevents:
- Fake webhook calls from attackers
- Unauthorized subscription activations
- Data tampering

The endpoint uses `stripe.webhooks.constructEvent()` with:
- Raw request body (required for signature verification)
- Stripe signature header (`stripe-signature`)
- Webhook secret from environment variables

## Production Checklist

Before going live:
- [ ] Webhook endpoint is configured in **Live mode** Stripe Dashboard
- [ ] `STRIPE_WEBHOOK_SECRET` contains the **live mode** secret
- [ ] Test a real payment to verify webhook activation
- [ ] Monitor webhook delivery in Stripe Dashboard
- [ ] Set up email notifications in Stripe for failed webhooks

## References

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI for testing](https://stripe.com/docs/stripe-cli)
- [Webhook signature verification](https://stripe.com/docs/webhooks/signatures)

# Stripe Checkout Setup Instructions

Your Stripe checkout integration has been set up! Follow these steps to complete the configuration:

## 1. Create Stripe Products and Prices

Log into your [Stripe Dashboard](https://dashboard.stripe.com) and create the following products:

### Premier Membership
- **Product Name**: Premier Membership
- **Monthly Price**: $25.00
  - Create a recurring price with monthly billing
  - Copy the Price ID (starts with `price_`)
- **Yearly Price**: $240.00
  - Create a recurring price with yearly billing
  - Copy the Price ID (starts with `price_`)

### Pro Membership
- **Product Name**: Pro Membership
- **Monthly Price**: $35.00
  - Create a recurring price with monthly billing
  - Copy the Price ID (starts with `price_`)
- **Yearly Price**: $336.00
  - Create a recurring price with yearly billing
  - Copy the Price ID (starts with `price_`)

## 2. Update Price IDs

Open `js/stripe-checkout.js` and replace the placeholder Price IDs with your actual Stripe Price IDs:

```javascript
const PRICE_IDS = {
    premier_monthly: 'price_XXXXXXXXXXXXXXX',  // Replace with actual Price ID
    premier_yearly: 'price_XXXXXXXXXXXXXXX',   // Replace with actual Price ID
    pro_monthly: 'price_XXXXXXXXXXXXXXX',      // Replace with actual Price ID
    pro_yearly: 'price_XXXXXXXXXXXXXXX'        // Replace with actual Price ID
};
```

## 3. Deploy the Backend API

The file `api/create-checkout-session.js` needs to be deployed as a serverless function. Here are your options:

### Option A: Vercel (Recommended)
1. Install Vercel CLI: `npm install -g vercel`
2. Run `vercel` in your project directory
3. The API will be automatically deployed to `/api/create-checkout-session`

### Option B: Netlify Functions
1. Move `api/create-checkout-session.js` to `netlify/functions/`
2. Rename to `create-checkout-session.js`
3. Deploy with Netlify CLI or via Git

### Option C: AWS Lambda
1. Create a Lambda function
2. Upload the code
3. Set up API Gateway
4. Update the endpoint URL in `js/stripe-checkout.js`

## 4. Install Dependencies

If using serverless functions, install the Stripe Node.js library:

```bash
npm init -y
npm install stripe
```

## 5. Update Success/Cancel URLs

In `api/create-checkout-session.js`, update the URLs if needed:
- **success_url**: Currently set to `/success.html`
- **cancel_url**: Currently set to `/membership.html?canceled=true`

## 6. Set Up Webhooks (Optional but Recommended)

To handle subscription events (cancellations, failed payments, etc.):

1. Go to [Stripe Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://yourdomain.com/api/webhook`
3. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

## 7. Test the Integration

### Test Mode
1. Switch to Stripe test mode in the dashboard
2. Update the keys in your code to test keys
3. Use test card: `4242 4242 4242 4242`
4. Test the checkout flow

### Live Mode
1. Switch back to live mode
2. Update to live keys (already configured)
3. Test with a real card
4. Verify the subscription appears in your Stripe dashboard

## 8. Basic Membership (Free)

For the free Basic membership:
1. Create a simple signup form at `/basic-signup.html`
2. Collect user information (email, name, etc.)
3. Store in your database (Supabase or other)
4. Send welcome email

## Security Notes

- ✅ Your Secret Key is only used server-side (in the API file)
- ✅ Your Publishable Key is safe to use client-side
- ⚠️ Never commit sensitive keys to Git (consider using environment variables)
- ⚠️ Always validate webhook signatures to prevent fraud

## Files Created

1. **js/stripe-checkout.js** - Frontend checkout handling
2. **api/create-checkout-session.js** - Backend API endpoint
3. **success.html** - Post-checkout success page
4. **membership.html** - Updated with Stripe integration

## Support

If you need help with Stripe setup:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)
- Email: bhinrichs1380@gmail.com

## Next Steps

- [ ] Create products and prices in Stripe Dashboard
- [ ] Update Price IDs in stripe-checkout.js
- [ ] Deploy the API endpoint
- [ ] Test in test mode
- [ ] Set up webhooks
- [ ] Go live!

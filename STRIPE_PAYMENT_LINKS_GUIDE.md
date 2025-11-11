# Quick Stripe Payment Links Setup Guide

**The easiest way to get Stripe working - No backend code needed!**

## Step 1: Log into Stripe Dashboard

Go to [https://dashboard.stripe.com](https://dashboard.stripe.com) and log in with your account.

## Step 2: Create Payment Links

### For Premier Monthly ($25/month)
1. Click **"Payment links"** in the left sidebar
2. Click **"+ New"** button
3. Click **"+ Add product"**
4. Enter:
   - **Product name**: Premier Membership - Monthly
   - **Price**: $25.00
   - **Billing period**: Monthly
   - **Type**: Recurring
5. Click **"Add product"**
6. Under **"After payment"**:
   - Set success URL: `https://www.hsst.com/success.html`
7. Click **"Create link"**
8. **Copy the payment link** (looks like `https://buy.stripe.com/xxxxx`)
9. Paste it in `js/stripe-checkout.js` at line 10

### For Premier Yearly ($240/year)
1. Click **"+ New"** to create another payment link
2. Click **"+ Add product"**
3. Enter:
   - **Product name**: Premier Membership - Yearly
   - **Price**: $240.00
   - **Billing period**: Yearly
   - **Type**: Recurring
4. Click **"Add product"**
5. Set success URL: `https://www.hsst.com/success.html`
6. Click **"Create link"**
7. **Copy the payment link** and paste in `js/stripe-checkout.js` at line 11

### For Pro Monthly ($35/month)
1. Click **"+ New"**
2. Click **"+ Add product"**
3. Enter:
   - **Product name**: Pro Membership - Monthly
   - **Price**: $35.00
   - **Billing period**: Monthly
   - **Type**: Recurring
4. Click **"Add product"**
5. Set success URL: `https://www.hsst.com/success.html`
6. Click **"Create link"**
7. **Copy the payment link** and paste in `js/stripe-checkout.js` at line 12

### For Pro Yearly ($336/year)
1. Click **"+ New"**
2. Click **"+ Add product"**
3. Enter:
   - **Product name**: Pro Membership - Yearly
   - **Price**: $336.00
   - **Billing period**: Yearly
   - **Type**: Recurring
4. Click **"Add product"**
5. Set success URL: `https://www.hsst.com/success.html`
6. Click **"Create link"**
7. **Copy the payment link** and paste in `js/stripe-checkout.js` at line 13

## Step 3: Update stripe-checkout.js

Open `js/stripe-checkout.js` and replace the Payment Links:

```javascript
const PAYMENT_LINKS = {
    premier_monthly: 'https://buy.stripe.com/YOUR_ACTUAL_LINK',
    premier_yearly: 'https://buy.stripe.com/YOUR_ACTUAL_LINK',
    pro_monthly: 'https://buy.stripe.com/YOUR_ACTUAL_LINK',
    pro_yearly: 'https://buy.stripe.com/YOUR_ACTUAL_LINK'
};
```

## Step 4: Test It!

1. Open your website
2. Go to the membership page
3. Click any "Subscribe" button
4. You should be redirected to Stripe's payment page
5. Use test card: `4242 4242 4242 4242` (any future date, any CVV)
6. Complete the test payment
7. You should be redirected to your success page

## Step 5: Go Live!

Once testing is complete:
1. Make sure you're using your **live** keys (already configured)
2. Payment Links work in both test and live mode
3. Deploy your website
4. Start accepting payments!

## How It Works

When a user clicks "Subscribe":
1. The button click triggers the JavaScript function
2. It checks which billing period is selected (monthly/yearly)
3. It redirects the user to the appropriate Stripe Payment Link
4. Stripe handles the entire payment process
5. After payment, user is redirected to your success page
6. Stripe automatically manages subscriptions, invoices, and emails

## Benefits of Payment Links

✅ **No backend code required**
✅ **Stripe handles all payment processing**
✅ **Automatic subscription management**
✅ **Customer portal for managing subscriptions**
✅ **Automatic emails for receipts and invoices**
✅ **Works immediately - no additional setup**

## Managing Subscriptions

Your customers can manage their subscriptions at:
`https://billing.stripe.com/p/login/xxxxxx`

You can find this link in your Stripe Dashboard under Settings → Customer portal

## Need More Control?

If you need more customization, you can switch to Checkout Sessions by:
1. Setting `USE_PAYMENT_LINKS = false` in `stripe-checkout.js`
2. Following the instructions in `STRIPE_SETUP_INSTRUCTIONS.md`
3. Setting up the backend API

But for most use cases, Payment Links are perfect!

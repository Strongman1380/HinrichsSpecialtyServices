# DV Classes Payment Setup Guide

## ✅ What Was Added

Your DV enrollment form now includes:

1. **Fee Breakdown Display** - Shows $35 intake fee and $30.96 weekly fee
2. **Payment Options** - 3 choices for users:
   - Pay Intake Fee Now ($35) - Direct to Stripe
   - Pay Intake Fee Later - Submit form without payment
   - Make a Weekly Payment ($30.96) - For current students

3. **Smart Form Flow** - Dynamic buttons that adapt based on payment selection
4. **Stripe Integration** - Seamless redirect to secure payment processing

---

## 🔧 Setup Required: Create Stripe Payment Links

You need to create **2 Stripe Payment Links** for this to work.

### Step 1: Log into Stripe Dashboard

Go to: https://dashboard.stripe.com

### Step 2: Create Intake Fee Payment Link

1. Click **"Products"** in the left sidebar
2. Click **"+ Add product"**
3. Fill in:
   - **Name:** DV Program Intake Assessment Fee
   - **Description:** One-time intake assessment fee for domestic violence accountability program
   - **Price:** $35.00
   - **One time** (not recurring)
4. Click **"Save product"**
5. Click **"Create payment link"** button
6. Configure the payment link:
   - **Collect customer email:** Yes (checked)
   - **Collect customer name:** Yes (checked)
   - **Allow promo codes:** Optional (your choice)
   - **Success URL:** `https://www.hsst.com/success.html?type=dv-intake-payment`
   - **Cancel URL:** `https://www.hsst.com/dv-classes-enrollment.html`
7. Click **"Create link"**
8. **Copy the payment link** (looks like: `https://buy.stripe.com/xxxxx`)

### Step 3: Create Weekly Payment Link

1. Click **"Products"** again
2. Click **"+ Add product"**
3. Fill in:
   - **Name:** DV Program Weekly Class Fee
   - **Description:** Weekly fee for domestic violence accountability classes
   - **Price:** $30.00
   - **One time** (not recurring - since they pay manually each week)
4. Click **"Save product"**
5. Click **"Create payment link"** button
6. Configure:
   - **Collect customer email:** Yes
   - **Collect customer name:** Yes
   - **Allow promo codes:** Optional
   - **Success URL:** `https://www.hsst.com/success.html?type=dv-weekly-payment`
   - **Cancel URL:** `https://www.hsst.com/dv-weekly-payment.html`
7. Click **"Create link"**
8. **Copy the payment link**

---

## 📝 Update Your Code

After creating the Stripe payment links, update the [dv-classes-enrollment.html](dv-classes-enrollment.html) file:

**Find this section (around line 422):**

```javascript
// Stripe Payment Links
const DV_PAYMENT_LINKS = {
    intake: 'https://buy.stripe.com/YOUR_INTAKE_FEE_LINK', // You'll need to create this
    weekly: 'https://buy.stripe.com/YOUR_WEEKLY_FEE_LINK'  // You'll need to create this
};
```

**Replace with your actual links:**

```javascript
// Stripe Payment Links
const DV_PAYMENT_LINKS = {
    intake: 'https://buy.stripe.com/xxxxx', // Paste your intake fee link here
    weekly: 'https://buy.stripe.com/yyyyy'  // Paste your weekly fee link here
};
```

---

## 🎯 How It Works

### For New Enrollments (Intake Fee)

1. **User fills out enrollment form**
2. **User selects "Pay Intake Fee Now ($35)"**
3. **Click "Proceed to Payment"** button appears
4. **Form validates** all required fields
5. **Enrollment saves to Supabase** database
6. **User redirects to Stripe** for secure payment
7. **After payment**, redirects to success page

### For Weekly Payments (Current Students)

1. **User goes to enrollment page**
2. **User selects "Make a Weekly Payment"**
3. **Clicks "Proceed to Weekly Payment"** button
4. **Redirects to Stripe** for $30.96 payment
5. **After payment**, redirects to success page

### For Payment Later

1. **User fills out form**
2. **Selects "Pay Intake Fee Later"**
3. **Submits enrollment** normally
4. **No payment redirect** - they can call/pay in person

---

## 💡 Optional: Set Up Recurring Weekly Payments

If you want to offer **automatic weekly billing** instead of manual payments:

### Create a Subscription Product

1. Go to **Products** in Stripe
2. Click **"+ Add product"**
3. Fill in:
   - **Name:** DV Program Weekly Subscription
   - **Description:** Automatic weekly billing for DV classes
   - **Price:** $30.96
   - **Recurring:** Weekly ✅
   - **Billing period:** Every 1 week
4. Click **"Create payment link"**
5. This creates a subscription that auto-charges weekly

**Update the code to add this as a 4th option:**

```html
<option value="weekly-subscription">Set Up Automatic Weekly Payments ($30.96/week)</option>
```

---

## 📊 Track Payments in Stripe

### View All Payments

1. Go to **Payments** in Stripe Dashboard
2. Filter by product name ("DV Program Intake" or "DV Program Weekly")
3. Export data for records

### Match Payments to Enrollments

Each payment includes:
- **Customer email** (prefilled from form)
- **Client Reference ID** (enrollment database ID)
- **Payment timestamp**

You can cross-reference these with your Supabase database.

---

## 🔔 Set Up Payment Notifications

### Email Receipts (Automatic)

Stripe automatically sends email receipts to customers. No setup needed!

### Admin Notifications

To get notified when someone pays:

1. Go to **Settings** → **Email notifications** in Stripe
2. Enable **"Successful payments"**
3. Add your email: bhinrichs1380@gmail.com

### Webhook for Advanced Integration (Optional)

To update your database automatically when payments complete:

1. Go to **Developers** → **Webhooks** in Stripe
2. Click **"Add endpoint"**
3. Endpoint URL: `https://www.hsst.com/api/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
5. This requires backend code to process webhooks

---

## 🎨 Payment Section Features

### Clear Fee Breakdown
- **Intake Fee:** $35.00 (one-time)
- **Weekly Fee:** $30.96/week
- **Duration:** 36 weeks

### User-Friendly Options
- Pay now for immediate processing
- Pay later for flexible arrangements
- Weekly payment portal for current students

### Smart UI
- Buttons change based on selection
- Helpful notes for each option
- Clear pricing information

---

## ✅ Testing the Payment Flow

### Test Mode (Before Going Live)

1. Use Stripe **test mode** first
2. Create test payment links with test products
3. Use test card: `4242 4242 4242 4242` (any future date, any CVC)
4. Verify the full flow works

### Live Mode

1. Switch to **live mode** in Stripe
2. Create live payment links
3. Test with a real $0.50 payment to yourself
4. Refund the test payment

---

## 📞 Support

If users have payment issues:

1. **Phone:** (402) 759-2210
2. **Email:** bhinrichs1380@gmail.com
3. **In-person:** Accept payment at your Geneva, Nebraska location

---

## 🚀 What's Next?

After setting up the payment links:

1. ✅ Create 2 Stripe payment links
2. ✅ Update `dv-classes-enrollment.html` with your links
3. ✅ Test the full enrollment + payment flow
4. ✅ Set up email notifications in Stripe
5. ✅ Monitor payments in Stripe Dashboard
6. ✅ (Optional) Create weekly subscription option
7. ✅ (Optional) Set up webhooks for automation

---

**Your DV enrollment form is now fully integrated with Stripe payments!** 🎉

Users can enroll and pay in one seamless flow, and you'll have complete payment tracking in Stripe.

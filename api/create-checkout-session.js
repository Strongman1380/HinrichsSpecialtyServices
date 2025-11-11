// Backend API endpoint for creating Stripe Checkout sessions
// This file should be deployed as a serverless function or API endpoint

// IMPORTANT: Set your Stripe secret key as an environment variable
// For Vercel/Netlify: Add STRIPE_SECRET_KEY in your dashboard
// Never commit your actual secret key to version control
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { priceId, planType, billingPeriod } = req.body;

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${req.headers.origin || 'https://www.hsst.com'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin || 'https://www.hsst.com'}/membership.html?canceled=true`,
            metadata: {
                planType: planType,
                billingPeriod: billingPeriod
            },
            allow_promotion_codes: true,
            billing_address_collection: 'auto',
            customer_email: undefined, // Customer will enter email in checkout
        });

        res.status(200).json({ id: session.id });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
};

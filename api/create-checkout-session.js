// Retained only so a stale deployment cannot reactivate the retired checkout route.

module.exports = async (req, res) => {
    res.status(410).json({ error: 'Online checkout has been retired. Contact HSST for approved payment methods.' });
    return;

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
        const { priceId, planType, billingPeriod, paymentType, email, name, weekNumber } = req.body;
        const origin = req.headers.origin || 'https://www.hinrichsspecialtyservices.com';

        let sessionConfig = {
            payment_method_types: ['card'],
            billing_address_collection: 'auto',
            success_url: `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/membership.html?canceled=true`,
            metadata: {},
        };

        if (email) {
            sessionConfig.customer_email = email;
        }

        // Handle DV payment types first
        if (paymentType === 'dv-intake') {
            sessionConfig.mode = 'payment';
            sessionConfig.success_url = `${origin}/success.html?type=dv-intake-payment&session_id={CHECKOUT_SESSION_ID}`;
            sessionConfig.cancel_url = `${origin}/dv-weekly-payment.html`;
            sessionConfig.metadata = { paymentType, name, email };
            sessionConfig.line_items = [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'DV Program Intake Assessment Fee',
                        description: 'One-time intake assessment fee for domestic violence accountability program',
                    },
                    unit_amount: 3500, // $35.00
                },
                quantity: 1,
            }];
        } else if (paymentType === 'dv-weekly') {
            sessionConfig.mode = 'payment';
            sessionConfig.success_url = `${origin}/success.html?type=dv-weekly-payment&session_id={CHECKOUT_SESSION_ID}`;
            sessionConfig.cancel_url = `${origin}/dv-weekly-payment.html`;
            sessionConfig.metadata = { paymentType, name, email, weekNumber: weekNumber || 'N/A' };
            sessionConfig.line_items = [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'DV Program Weekly Class Fee',
                        description: `Weekly class fee${weekNumber ? ` - Week ${weekNumber}` : ''}`,
                    },
                    unit_amount: 3000, // $30.00
                },
                quantity: 1,
            }];
        } else if (paymentType === 'dv-autopay') {
            sessionConfig.mode = 'subscription';
            sessionConfig.success_url = `${origin}/success.html?type=dv-weekly-payment&session_id={CHECKOUT_SESSION_ID}`;
            sessionConfig.cancel_url = `${origin}/dv-weekly-payment.html`;
            sessionConfig.metadata = { paymentType, name, email };
            sessionConfig.line_items = [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: 'DV Program Weekly Subscription',
                        description: 'Automatic weekly billing for DV classes',
                    },
                    unit_amount: 3000, // $30.00
                    recurring: {
                        interval: 'week',
                    },
                },
                quantity: 1,
            }];
        } else {
            // Default to memberships
            sessionConfig.mode = 'subscription';
            sessionConfig.cancel_url = `${origin}/membership.html?canceled=true`;
            sessionConfig.metadata = { planType, billingPeriod };

            // If a valid Price ID is provided, use it
            if (priceId && priceId.startsWith('price_')) {
                sessionConfig.line_items = [{
                    price: priceId,
                    quantity: 1,
                }];
            } else {
                // Generate dynamic price_data for memberships if priceId is not set
                let amount = 2500; // Default premier_monthly: $25.00
                let interval = 'month';
                let prodName = 'Premier Membership';
                let prodDesc = 'Enhanced access for active community members';

                const targetPlan = planType || (priceId || '');
                if (targetPlan.includes('premier_yearly') || targetPlan.includes('premier-yearly')) {
                    amount = 24000;
                    interval = 'year';
                } else if (targetPlan.includes('pro_monthly') || targetPlan.includes('pro-monthly')) {
                    amount = 3500;
                    prodName = 'Pro Membership';
                    prodDesc = 'Maximum value for organizations and leaders';
                } else if (targetPlan.includes('pro_yearly') || targetPlan.includes('pro-yearly')) {
                    amount = 33600;
                    interval = 'year';
                    prodName = 'Pro Membership';
                    prodDesc = 'Maximum value for organizations and leaders';
                }

                sessionConfig.line_items = [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: prodName,
                            description: prodDesc,
                        },
                        unit_amount: amount,
                        recurring: {
                            interval: interval,
                        },
                    },
                    quantity: 1,
                }];
            }
            sessionConfig.allow_promotion_codes = true;
        }

        // Create Checkout Session
        const session = await stripe.checkout.sessions.create(sessionConfig);

        res.status(200).json({ id: session.id, url: session.url });

    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: error.message });
    }
};

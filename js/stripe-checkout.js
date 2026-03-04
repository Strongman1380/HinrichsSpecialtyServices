// Stripe Publishable Key
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51Rcc6ZDN7bYAn961fIpWmQnvdTHeXyWrSyVNGUWtQ3RU4B3sEjq5thzyXNB9NABoZbD8vDPgZUgzLIQ1EZlCzVR200cXmKiJUw';

// Initialize Stripe
const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);

// Stripe Payment Links for each membership tier
const PAYMENT_LINKS = {
    premier_monthly: 'https://buy.stripe.com/cNi28rcUUdkxbKi6CheZ202',
    premier_yearly: 'https://buy.stripe.com/cNi4gz8EEfsF29I5ydeZ203',
    pro_monthly: 'https://buy.stripe.com/3cIcN54ooa8l9Cad0FeZ204',
    pro_yearly: 'https://buy.stripe.com/bJecN51cc80d15Ef8NeZ205'
};

// Handle Premier checkout
function handlePremierCheckout() {
    const billingPeriod = document.querySelector('input[name="premier-billing"]:checked').value;
    const planType = billingPeriod === 'monthly' ? 'premier-monthly' : 'premier-yearly';
    // Redirect to enrollment page with plan parameter
    window.location.href = `enrollment.html?plan=${planType}`;
}

// Handle Pro checkout
function handleProCheckout() {
    const billingPeriod = document.querySelector('input[name="pro-billing"]:checked').value;
    const planType = billingPeriod === 'monthly' ? 'pro-monthly' : 'pro-yearly';
    // Redirect to enrollment page with plan parameter
    window.location.href = `enrollment.html?plan=${planType}`;
}

// Handle Basic (Free) signup
function handleBasicSignup() {
    // For free tier, collect email and redirect to member portal
    const email = prompt('Please enter your email address to join:');
    if (email && validateEmail(email)) {
        // Store in your database or send to your backend
        console.log('Free signup for:', email);
        alert('Welcome! Check your email for next steps.');
        // Optionally redirect to success page
        // window.location.href = '/success.html?plan=basic';
    } else if (email) {
        alert('Please enter a valid email address.');
    }
}

// Validate email format
function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Create Stripe Checkout Session (only used if USE_PAYMENT_LINKS = false)
async function createCheckoutSession(priceId, planType, billingPeriod) {
    try {
        showLoadingState();

        const response = await fetch('/api/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                priceId: priceId,
                planType: planType,
                billingPeriod: billingPeriod
            })
        });

        const session = await response.json();

        if (session.error) {
            throw new Error(session.error);
        }

        // Redirect to Stripe Checkout
        const result = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (result.error) {
            throw new Error(result.error.message);
        }

    } catch (error) {
        console.error('Error:', error);
        alert('There was an error processing your request. Please try again or contact support at bhinrichs1380@gmail.com');
        hideLoadingState();
    }
}

// Loading state functions
function showLoadingState() {
    document.body.style.cursor = 'wait';
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    overlay.innerHTML = '<div style="background:white;padding:2rem;border-radius:8px;text-align:center;"><div style="font-size:1.2rem;color:#333;">Processing...</div></div>';
    document.body.appendChild(overlay);
}

function hideLoadingState() {
    document.body.style.cursor = 'default';
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Initialize event listeners when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Premier plan buttons
    const premierButtons = document.querySelectorAll('a[href="#signup-premier"]');
    premierButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            handlePremierCheckout();
        });
    });

    // Pro plan buttons
    const proButtons = document.querySelectorAll('a[href="#signup-pro"]');
    proButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            handleProCheckout();
        });
    });

    // Basic plan buttons
    const basicButtons = document.querySelectorAll('a[href="#signup-basic"]');
    basicButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            handleBasicSignup();
        });
    });
});

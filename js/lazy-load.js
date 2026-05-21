/**
 * Lazy Loading Utilities
 * Dynamic imports for better performance
 */

// Lazy load chatbot only when container exists
export async function loadChatbot() {
    const container = document.querySelector('.chatbot-container, #chatbot, [data-chatbot]');
    if (!container) {
        console.log('No chatbot container found, skipping chatbot load');
        return;
    }
    
    console.log('Lazy loading chatbot...');
    
    try {
        // Dynamically import chatbot module
        const { initChatbot } = await import('./chatbot.js');
        
        // Initialize if function exists
        if (typeof initChatbot === 'function') {
            initChatbot();
        } else if (typeof initChatbot === 'object' && initChatbot.default) {
            initChatbot.default();
        }
        
        console.log('Chatbot loaded successfully');
    } catch (error) {
        console.error('Failed to load chatbot:', error);
    }
}

// Lazy load an external script
export function loadScript(src, options = {}) {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.async = options.async !== false;
        script.defer = options.defer || false;
        
        if (options.integrity) {
            script.integrity = options.integrity;
        }
        
        if (options.crossOrigin) {
            script.crossOrigin = options.crossOrigin;
        }
        
        script.onload = resolve;
        script.onerror = reject;
        
        document.head.appendChild(script);
    });
}

// Lazy load Stripe.js only when needed (for checkout pages)
export function loadStripe(publishableKey) {
    return loadScript('https://js.stripe.com/v3/').then(() => {
        if (typeof Stripe !== 'undefined') {
            return Stripe(publishableKey);
        }
        throw new Error('Stripe.js failed to load');
    });
}

// Intersection Observer for lazy loading images
export function setupLazyImages() {
    if (!('IntersectionObserver' in window)) {
        // Fallback: load all images immediately
        document.querySelectorAll('img[data-src]').forEach(img => {
            img.src = img.dataset.src;
        });
        return;
    }
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                observer.unobserve(img);
            }
        });
    }, {
        rootMargin: '50px 0px',
        threshold: 0.01
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
        observer.observe(img);
    });
}

// Initialize lazy loading based on page content
export function initLazyLoading() {
    // Load chatbot if container exists
    loadChatbot();
    
    // Setup lazy images
    setupLazyImages();
}

// Auto-init when DOM is ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initLazyLoading);
    } else {
        initLazyLoading();
    }
}

// Export for manual use
window.loadChatbot = loadChatbot;
window.loadScript = loadScript;
window.loadStripe = loadStripe;

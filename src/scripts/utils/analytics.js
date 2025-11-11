/**
 * Analytics and Monitoring Utilities
 * Supports Google Analytics 4, Plausible, and custom event tracking
 */

// Analytics configuration
const config = {
  ga4: {
    measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || '',
    enabled: false
  },
  plausible: {
    domain: 'www.hsst.com',
    enabled: false
  },
  sentry: {
    dsn: import.meta.env.VITE_SENTRY_DSN || '',
    enabled: false
  }
};

// Initialize Google Analytics 4
export function initGA4() {
  if (!config.ga4.measurementId || config.ga4.enabled) return;

  // Load gtag script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${config.ga4.measurementId}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag('js', new Date());
  gtag('config', config.ga4.measurementId, {
    send_page_view: true,
    anonymize_ip: true
  });

  config.ga4.enabled = true;
  console.log('✅ Google Analytics 4 initialized');
}

// Initialize Plausible Analytics (privacy-friendly alternative)
export function initPlausible() {
  if (config.plausible.enabled) return;

  const script = document.createElement('script');
  script.defer = true;
  script.setAttribute('data-domain', config.plausible.domain);
  script.src = 'https://plausible.io/js/script.js';
  document.head.appendChild(script);

  config.plausible.enabled = true;
  console.log('✅ Plausible Analytics initialized');
}

// Initialize Sentry for error tracking
export function initSentry() {
  if (!config.sentry.dsn || config.sentry.enabled) return;

  import('@sentry/browser').then(Sentry => {
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: import.meta.env.VITE_ENV || 'production',
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay()
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0
    });

    config.sentry.enabled = true;
    console.log('✅ Sentry error tracking initialized');
  }).catch(err => {
    console.warn('Failed to load Sentry:', err);
  });
}

// Track custom events
export function trackEvent(eventName, eventParams = {}) {
  // Google Analytics 4
  if (config.ga4.enabled && window.gtag) {
    window.gtag('event', eventName, eventParams);
  }

  // Plausible
  if (config.plausible.enabled && window.plausible) {
    window.plausible(eventName, { props: eventParams });
  }

  // Console log in development
  if (import.meta.env.DEV) {
    console.log('📊 Event tracked:', eventName, eventParams);
  }
}

// Track page views
export function trackPageView(path = window.location.pathname) {
  trackEvent('page_view', {
    page_path: path,
    page_title: document.title,
    page_location: window.location.href
  });
}

// Track form submissions
export function trackFormSubmit(formName, formData = {}) {
  trackEvent('form_submit', {
    form_name: formName,
    ...formData
  });
}

// Track button clicks
export function trackButtonClick(buttonName, additionalData = {}) {
  trackEvent('button_click', {
    button_name: buttonName,
    ...additionalData
  });
}

// Track outbound links
export function trackOutboundLink(url, linkText) {
  trackEvent('outbound_link_click', {
    link_url: url,
    link_text: linkText
  });
}

// Track downloads
export function trackDownload(fileName, fileType) {
  trackEvent('file_download', {
    file_name: fileName,
    file_type: fileType
  });
}

// Track search queries
export function trackSearch(searchTerm, searchResults = 0) {
  trackEvent('search', {
    search_term: searchTerm,
    search_results: searchResults
  });
}

// Track conversions (membership signups, enrollments)
export function trackConversion(conversionType, value = 0) {
  trackEvent('conversion', {
    conversion_type: conversionType,
    value: value
  });
}

// Track errors
export function trackError(errorMessage, errorType = 'javascript_error') {
  if (config.sentry.enabled && window.Sentry) {
    window.Sentry.captureException(new Error(errorMessage));
  }

  trackEvent('error', {
    error_message: errorMessage,
    error_type: errorType,
    page_path: window.location.pathname
  });
}

// Core Web Vitals tracking
export function trackWebVitals() {
  if (typeof window === 'undefined') return;

  // Import web-vitals library dynamically
  import('web-vitals').then(({ onCLS, onFID, onFCP, onLCP, onTTFB }) => {
    onCLS(metric => trackEvent('web_vitals', {
      metric_name: 'CLS',
      value: metric.value,
      rating: metric.rating
    }));

    onFID(metric => trackEvent('web_vitals', {
      metric_name: 'FID',
      value: metric.value,
      rating: metric.rating
    }));

    onFCP(metric => trackEvent('web_vitals', {
      metric_name: 'FCP',
      value: metric.value,
      rating: metric.rating
    }));

    onLCP(metric => trackEvent('web_vitals', {
      metric_name: 'LCP',
      value: metric.value,
      rating: metric.rating
    }));

    onTTFB(metric => trackEvent('web_vitals', {
      metric_name: 'TTFB',
      value: metric.value,
      rating: metric.rating
    }));
  }).catch(err => {
    console.warn('Failed to load web-vitals library:', err);
  });
}

// Auto-track all outbound links
export function autoTrackOutboundLinks() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;

    // Check if it's an outbound link
    if (href.startsWith('http') && !href.includes(window.location.hostname)) {
      trackOutboundLink(href, link.textContent.trim());
    }

    // Check if it's a download link
    const downloadExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.csv'];
    if (downloadExtensions.some(ext => href.toLowerCase().endsWith(ext))) {
      const fileName = href.split('/').pop();
      const fileType = fileName.split('.').pop();
      trackDownload(fileName, fileType);
    }
  });
}

// Session tracking
let sessionStartTime = Date.now();
let sessionEventCount = 0;

export function trackSessionMetrics() {
  const sessionDuration = (Date.now() - sessionStartTime) / 1000; // seconds

  trackEvent('session_metrics', {
    session_duration: Math.round(sessionDuration),
    events_count: sessionEventCount,
    pages_viewed: sessionStorage.getItem('pages_viewed') || 1
  });
}

// Track when user is about to leave
window.addEventListener('beforeunload', () => {
  trackSessionMetrics();
});

// Update pages viewed
function incrementPagesViewed() {
  const pagesViewed = parseInt(sessionStorage.getItem('pages_viewed') || '0') + 1;
  sessionStorage.setItem('pages_viewed', pagesViewed.toString());
}

// Initialize all analytics
export function initAnalytics() {
  // Choose your analytics provider(s)
  // Uncomment the ones you want to use:

  // initGA4(); // Google Analytics 4
  initPlausible(); // Privacy-friendly alternative (recommended)
  // initSentry(); // Error tracking

  // Track initial page view
  trackPageView();
  incrementPagesViewed();

  // Auto-track outbound links
  autoTrackOutboundLinks();

  // Track Core Web Vitals
  if (!import.meta.env.DEV) {
    trackWebVitals();
  }

  console.log('📊 Analytics initialized');
}

// Export all tracking functions
export default {
  init: initAnalytics,
  trackEvent,
  trackPageView,
  trackFormSubmit,
  trackButtonClick,
  trackOutboundLink,
  trackDownload,
  trackSearch,
  trackConversion,
  trackError,
  trackWebVitals
};

/**
 * Analytics and Monitoring Utilities
 * Supports Google Analytics 4 and custom event tracking.
 */

// Analytics configuration
const config = {
  ga4: {
    measurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || '',
    enabled: false
  }
};

// Initialize Google Analytics 4
export function initGA4() {
  if (!/^G-[A-Z0-9]+$/.test(config.ga4.measurementId) || /X{3,}/.test(config.ga4.measurementId) || config.ga4.enabled) return;

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
    send_page_view: false,
    anonymize_ip: true
  });

  config.ga4.enabled = true;
  console.log('✅ Google Analytics 4 initialized');
}

// Track custom events
export function trackEvent(eventName, eventParams = {}) {
  sessionEventCount += 1;
  // Google Analytics 4
  if (config.ga4.enabled && window.gtag) {
    window.gtag('event', eventName, eventParams);
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

// Track conversions.
export function trackConversion(conversionType, value = 0) {
  trackEvent('conversion', {
    conversion_type: conversionType,
    value: value
  });
}

// Track errors
export function trackError(errorMessage, errorType = 'javascript_error') {
  trackEvent('error', {
    error_message: errorMessage,
    error_type: errorType,
    page_path: window.location.pathname
  });
}

// Core Web Vitals tracking
export function trackWebVitals() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  const observe = (type, metricName) => {
    try {
      const observer = new PerformanceObserver((list) => {
        const entry = list.getEntries().at(-1);
        if (!entry) return;
        trackEvent('web_vitals', {
          metric_name: metricName,
          value: Math.round(entry.startTime || entry.duration || 0),
        });
        observer.disconnect();
      });
      observer.observe({ type, buffered: true });
    } catch {
      // Older browsers can safely skip unsupported performance entry types.
    }
  };

  observe('largest-contentful-paint', 'LCP');
  observe('first-contentful-paint', 'FCP');
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
let initialized = false;

export function trackSessionMetrics() {
  const sessionDuration = (Date.now() - sessionStartTime) / 1000; // seconds

  trackEvent('session_metrics', {
    session_duration: Math.round(sessionDuration),
    events_count: sessionEventCount,
    pages_viewed: getPagesViewed() || 1
  });
}

// Track when user is about to leave
window.addEventListener('beforeunload', () => {
  trackSessionMetrics();
});

// Update pages viewed
function incrementPagesViewed() {
  try { sessionStorage.setItem('pages_viewed', String(getPagesViewed() + 1)); } catch { /* Storage may be disabled. */ }
}

function getPagesViewed() {
  try { return Number(sessionStorage.getItem('pages_viewed')) || 0; } catch { return 0; }
}

// Initialize all analytics
export function initAnalytics() {
  if (initialized) return;
  initialized = true;
  initGA4();

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

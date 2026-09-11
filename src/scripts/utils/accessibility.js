/**
 * Accessibility Utilities and Enhancements
 */

// Skip to main content link
export function createSkipLink() {
  const skipLink = document.createElement('a');
  skipLink.href = '#main-content';
  skipLink.className = 'skip-link';
  skipLink.textContent = 'Skip to main content';
  skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--blue, #3b82f6);
    color: #ffffff;
    padding: 8px 16px;
    text-decoration: none;
    font-weight: 600;
    z-index: 10000;
    border-radius: 0 0 4px 0;
    transition: top 0.3s;
  `;

  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
  });

  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });

  document.body.insertBefore(skipLink, document.body.firstChild);
}

// Add main landmark if missing
export function ensureMainLandmark() {
  const main = document.querySelector('main');
  if (main && !main.id) {
    main.id = 'main-content';
  } else if (!main) {
    const firstSection = document.querySelector('section');
    if (firstSection) {
      const mainEl = document.createElement('main');
      mainEl.id = 'main-content';
      firstSection.parentNode.insertBefore(mainEl, firstSection);
      mainEl.appendChild(firstSection);
    }
  }
}

// Enhance focus visibility
export function enhanceFocusVisibility() {
  const style = document.createElement('style');
  style.textContent = `
    :focus-visible {
      outline: 3px solid var(--blue, #3b82f6) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3) !important;
    }

    .nav-link:focus-visible,
    .btn:focus-visible,
    a:focus-visible,
    button:focus-visible,
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible {
      outline: 3px solid var(--blue, #3b82f6) !important;
      outline-offset: 2px !important;
    }
  `;
  document.head.appendChild(style);
}

// Add ARIA labels to unlabeled elements
export function addMissingAriaLabels() {
  // Label search inputs
  const searchInputs = document.querySelectorAll('input[type="search"]');
  searchInputs.forEach(input => {
    if (!input.getAttribute('aria-label') && !input.labels?.length) {
      input.setAttribute('aria-label', 'Search');
    }
  });

  // Label buttons without text
  const buttons = document.querySelectorAll('button:not([aria-label])');
  buttons.forEach(button => {
    if (!button.textContent.trim()) {
      const icon = button.querySelector('svg, img');
      if (icon) {
        button.setAttribute('aria-label', 'Button');
      }
    }
  });

  // Add role to navigation
  const navs = document.querySelectorAll('nav:not([role])');
  navs.forEach(nav => {
    nav.setAttribute('role', 'navigation');
  });
}

// Announce dynamic content changes
export function announceToScreenReader(message, priority = 'polite') {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.style.cssText = `
    position: absolute;
    left: -10000px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  `;

  document.body.appendChild(announcement);

  // Delay to ensure screen reader picks it up
  setTimeout(() => {
    announcement.textContent = message;
  }, 100);

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 3000);
}

// Form error announcements
export function announceFormError(fieldName, errorMessage) {
  announceToScreenReader(`Error in ${fieldName}: ${errorMessage}`, 'assertive');
}

// Form success announcements
export function announceFormSuccess(message) {
  announceToScreenReader(message, 'polite');
}

// Add aria-describedby for form errors
export function linkErrorToField(fieldId, errorId) {
  const field = document.getElementById(fieldId);
  const error = document.getElementById(errorId);

  if (field && error) {
    field.setAttribute('aria-describedby', errorId);
    field.setAttribute('aria-invalid', 'true');
    error.setAttribute('role', 'alert');
  }
}

// Remove error associations
export function removeErrorFromField(fieldId, errorId) {
  const field = document.getElementById(fieldId);

  if (field) {
    field.removeAttribute('aria-describedby');
    field.removeAttribute('aria-invalid');
  }
}

// Keyboard trap (for modals)
export class KeyboardTrap {
  constructor(element) {
    this.element = element;
    this.focusableElements = null;
    this.firstFocusable = null;
    this.lastFocusable = null;
  }

  activate() {
    this.focusableElements = this.element.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    this.firstFocusable = this.focusableElements[0];
    this.lastFocusable = this.focusableElements[this.focusableElements.length - 1];

    this.element.addEventListener('keydown', this.handleTab);
    this.firstFocusable?.focus();
  }

  deactivate() {
    this.element.removeEventListener('keydown', this.handleTab);
  }

  handleTab = (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      if (document.activeElement === this.firstFocusable) {
        this.lastFocusable?.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === this.lastFocusable) {
        this.firstFocusable?.focus();
        e.preventDefault();
      }
    }
  };
}

// Heading structure validator (development tool)
export function validateHeadingHierarchy() {
  if (import.meta.env.PROD) return;

  const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const issues = [];

  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName[1]);

    if (index === 0 && level !== 1) {
      issues.push(`First heading should be h1, found ${heading.tagName}`);
    }

    if (index > 0) {
      const prevLevel = parseInt(headings[index - 1].tagName[1]);
      if (level > prevLevel + 1) {
        issues.push(`Heading level skip: ${headings[index - 1].tagName} to ${heading.tagName}`);
      }
    }
  });

  if (issues.length > 0) {
    console.warn('Heading hierarchy issues:', issues);
  }
}

// Color contrast checker (development tool)
export function checkColorContrast(foreground, background) {
  // Convert hex to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  // Calculate relative luminance
  const getLuminance = (rgb) => {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);

  if (!fg || !bg) return null;

  const l1 = getLuminance(fg);
  const l2 = getLuminance(bg);

  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

  return {
    ratio: ratio.toFixed(2),
    passesAA: ratio >= 4.5,
    passesAAA: ratio >= 7,
    passesAALarge: ratio >= 3,
    passesAAALarge: ratio >= 4.5
  };
}

// Initialize all accessibility enhancements
export function initAccessibility() {
  createSkipLink();
  ensureMainLandmark();
  enhanceFocusVisibility();
  addMissingAriaLabels();

  if (import.meta.env.DEV) {
    validateHeadingHierarchy();
  }
}

// Export default initialization
export default {
  init: initAccessibility,
  announceToScreenReader,
  announceFormError,
  announceFormSuccess,
  linkErrorToField,
  removeErrorFromField,
  KeyboardTrap,
  validateHeadingHierarchy,
  checkColorContrast
};

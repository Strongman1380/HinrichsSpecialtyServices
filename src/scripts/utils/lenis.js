// Marcelo-aligned Lenis Smooth Scroll Setup
// Provides premium, consistent scroll experience across the site.

import Lenis from 'lenis';

let lenisInstance = null;

export function initLenis() {
  if (lenisInstance) {
    return lenisInstance;
  }

  lenisInstance = new Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.0010005 * Math.pow(2, 10 * (t - 1))), // Custom premium easing
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
    autoRaf: true, // Let Lenis handle requestAnimationFrame
  });

  // Expose globally for debugging or other scripts
  window.lenis = lenisInstance;

  // Sync with GSAP ScrollTrigger (Marcelo best practice)
  if (window.ScrollTrigger) {
    lenisInstance.on('scroll', window.ScrollTrigger.update);

    // Make ScrollTrigger use Lenis for smoother scrubbing
    window.ScrollTrigger.scrollerProxy(document.body, {
      scrollTop(value) {
        if (arguments.length) {
          lenisInstance.scrollTo(value, { immediate: true });
        }
        return lenisInstance.scroll;
      },
      getBoundingClientRect() {
        return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
      },
      pinType: document.body.style.transform ? "transform" : "fixed"
    });

    window.ScrollTrigger.addEventListener("refresh", () => lenisInstance.resize());
    window.ScrollTrigger.refresh();
  }

  console.log('[HSS] Lenis smooth scroll initialized (Marcelo mode)');

  return lenisInstance;
}

export function destroyLenis() {
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
    window.lenis = null;
  }
}

// Helper to scroll to an element with Lenis
export function scrollTo(target, options = {}) {
  if (!lenisInstance) {
    initLenis();
  }
  lenisInstance.scrollTo(target, {
    offset: options.offset || -80, // Account for fixed nav
    duration: options.duration || 1.2,
    easing: options.easing || ((t) => Math.min(1, 1.0010005 * Math.pow(2, 10 * (t - 1)))),
    ...options
  });
}

/**
 * HSS Marcelo Design System - Tailwind Extension
 *
 * Usage in tailwind.config.js:
 * const marcelo = require('./tailwind.marcelo');
 *
 * module.exports = {
 *   ...marcelo,
 *   // your other config
 * }
 */

module.exports = {
  theme: {
    extend: {
      colors: {
        // Marcelo HSS Tokens (OKLCH-based)
        navy: 'oklch(24% 0.08 240)',
        blue: 'oklch(52% 0.18 240)',
        orange: 'oklch(65% 0.22 45)',
        gold: 'oklch(72% 0.16 65)',

        background: 'oklch(98% 0.005 240)',
        surface: 'oklch(100% 0 0)',
        'surface-2': 'oklch(96% 0.01 240)',
        foreground: 'oklch(18% 0.02 240)',
        muted: 'oklch(45% 0.02 240)',
      },
      spacing: {
        'marcelo': '60px', // Signature Marcelo margin
      },
      borderRadius: {
        'marcelo': '2rem',
        'marcelo-lg': '2.5rem',
      },
      boxShadow: {
        'marcelo': '0 20px 48px -8px rgb(0 0 0 / 0.08)',
        'marcelo-hover': '0 24px 48px -8px rgb(0 0 0 / 0.12), 0 8px 16px -4px rgb(0 0 0 / 0.08)',
      },
      transitionTimingFunction: {
        'marcelo': 'cubic-bezier(0.23, 1, 0.32, 1)',
      },
    },
  },
};

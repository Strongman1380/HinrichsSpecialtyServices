# HSS Design System — Marcelo Strategic Sophistication

**Project**: Hinrichs Specialty Services & Technology (HSS)
**Version**: 1.0
**Date**: 2026
**Reference Protocols**: Marcelo UI Patterns + Site Builder Premium Frontend Protocol

---

## 1. Design Direction

**Name**: Refined Digital Craft

**Positioning**: High-end digital agency that combines strategic technology consulting with creative execution. The brand should feel **trustworthy, sophisticated, and premium** — never generic or template-like.

**Core Aesthetic Principles (Marcelo-adapted for HSS)**:
- **Disciplined luxury** over flashy cyberpunk.
- **Layered depth** and framing instead of flat sections.
- **Intentional breathing room** (60px margins as signature).
- **Craft over decoration** — every element should feel considered.
- Balance between professional consulting trust (Navy/Blue) and creative energy (Orange accents).

**Primary Vibe**: Dark-refined with strong light mode support. Think premium consulting firm that also does exceptional creative work.

---

## 2. Color Palette (OKLCH Primary)

We are moving to OKLCH for perceptual uniformity and better dark/light mode handling.

### Core Brand Colors

| Token          | OKLCH Value                  | Hex (approx) | Usage |
|----------------|------------------------------|--------------|-------|
| `--navy`       | oklch(24% 0.08 240)         | #132e54     | Primary text, deep backgrounds, strong anchors |
| `--blue`       | oklch(52% 0.18 240)         | #1a78e6     | Primary action, links, highlights |
| `--orange`     | oklch(65% 0.22 45)          | #f58220     | Accent, energy, CTAs, creative highlights |
| `--gold`       | oklch(72% 0.16 65)          | #f5a623     | Secondary accent, premium touches |

### Surface & Neutral System

| Token             | OKLCH Value                  | Usage |
|-------------------|------------------------------|-------|
| `--background`    | oklch(98% 0.005 240)        | Main page background (light) |
| `--surface`       | oklch(100% 0 0)             | Cards, modals, elevated surfaces |
| `--surface-2`     | oklch(96% 0.01 240)         | Subtle layered surfaces |
| `--foreground`    | oklch(18% 0.02 240)         | Primary text |
| `--muted`         | oklch(45% 0.02 240)         | Secondary text, captions |
| `--border`        | oklch(88% 0.01 240)         | Subtle borders |
| `--border-strong` | oklch(75% 0.02 240)         | Stronger dividers |

**Dark Mode Tokens** (to be defined in Phase 1 implementation):
- `--background`: oklch(12% 0.02 240)
- `--surface`: oklch(16% 0.02 240)
- `--foreground`: oklch(95% 0.01 240)

---

## 3. Typography

**Primary Stack**:
- **Headings**: Inter Variable (or Plus Jakarta Sans Variable for more personality)
- **Body**: Inter Variable

**Scale** (responsive using `clamp()`):

```css
--text-display: clamp(2.75rem, 2rem + 3.5vw, 4.5rem);
--text-hero:    clamp(2.25rem, 1.6rem + 3vw, 3.75rem);
--text-title:   clamp(1.5rem, 1.25rem + 1.25vw, 2.25rem);
--text-subtitle: clamp(1.1rem, 1rem + 0.5vw, 1.35rem);
--text-body:    1.05rem;
--text-small:   0.875rem;
```

**Weight Usage**:
- 800–900: Display / Hero titles
- 700: Section titles
- 600: Card titles, strong emphasis
- 500: Body default (slightly heavier than 400 for better screen presence)
- 400: Supporting text

---

## 4. Layout & Spacing System (Marcelo Core)

### Grid & Margins
- **Desktop**: Strict **60px horizontal margins** on the main content frame.
- **Content max-width**: 1200–1280px (with 60px side margins creating the "framed" premium feel).
- **12-column grid** with consistent 24px or 32px gutters.

### Layered Framing (Signature Pattern)
Instead of full-width sections, most content lives inside **layered frames**:

- Primary content container: `border-radius: 24px–40px`
- Subtle outer stroke or soft shadow for depth
- Background can be slightly different from page background (creates "object on surface" feeling)

Example structure:
```html
<div class="page-frame">
  <div class="content-frame">
    <!-- Actual content -->
  </div>
</div>
```

### Spacing Scale (Intentional Rhythm)
Use these values consistently (avoid arbitrary numbers):

- `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`, `80px`, `120px`

**Section vertical spacing**: Minimum 80–120px between major sections on desktop.

---

## 5. Depth & Surface Language

Marcelo relies heavily on **perceived depth**:

- **Level 0**: Page background
- **Level 1**: Primary content frames (subtle shadow or thin border)
- **Level 2**: Cards / interactive elements (stronger shadow + lift on hover)
- **Level 3**: Modals, dropdowns, floating elements

**Recommended shadow scale** (to be defined in tokens):
- `shadow-sm`
- `shadow-md`
- `shadow-lg`
- `shadow-hover` (used on interactive cards)

Use `backdrop-filter: blur(12px)` + thin white border at low opacity for glass effects on dark or hero areas.

---

## 6. Animation Language

**Foundation**:
- **Lenis** for smooth, premium scrolling (mandatory).
- **GSAP** for complex scroll-triggered and timeline animations.
- **Framer Motion** for component-level micro-interactions and React state transitions.

**Core Principles**:
- Most entrances: `fade-up` (opacity + y: 40–60px)
- Stagger children by 80–120ms
- Hover states: subtle lift (`translateY(-4px)`) + shadow intensification
- Easing: Prefer `cubic-bezier(0.23, 1, 0.32, 1)` (smooth, premium) over default ease
- Respect `prefers-reduced-motion`

**Hero / High-Impact Animations**:
- Staggered word or line reveals (not per-letter)
- Background elements (grain, subtle gradients) can have slow parallax or breathing

---

## 7. Component Rules (High-Level)

- **Buttons**: Never flat. Use gradient or layered shadow treatments. Primary CTAs get the strongest treatment.
- **Cards**: Always have clear depth (border or shadow). Hover = lift + enhanced shadow.
- **Navigation**: Frosted glass on scroll. "Floating pill" or anchored to content frame.
- **Section Headers**: Small uppercase eyebrow (often with subtle background pill), strong title, restrained subtitle.
- **Forms**: Clean, generous padding, excellent focus states (blue glow or orange accent).

All interactive elements must have **designed** hover and focus states — no default browser styles.

---

## 8. Migration Strategy Notes

Current state: Hybrid (many static `.html` files + partial Vite/React in `src/`).

**Recommended Path**:
1. Keep marketing pages as high-quality static HTML initially (faster to ship Marcelo upgrades).
2. Gradually extract shared components into a small React + Vite system.
3. Prioritize the pages that matter most for first impressions and conversion (Homepage → Services → AI Art / Creative).

**Short-term wins** (can be done in static HTML):
- Apply 60px margins + better section framing
- Upgrade typography scale and color usage
- Add Lenis + basic scroll-reveal animations
- Consistent button and card language

---

## 9. Success Criteria

A page "feels" like it follows this system when:
- It has clear breathing room (60px margins are obvious).
- Content feels framed and layered rather than flat.
- Every interactive element has intentional hover/focus behavior.
- Typography has strong, obvious hierarchy.
- Scroll experience feels smooth and premium (Lenis).
- It does **not** look like a default Tailwind or generic agency template.

---

**Next Steps (after this document is reviewed)**:
- Convert the OKLCH tokens into actual `tokens.css` + Tailwind config.
- Create the first set of base components.
- Run a full audit of the current homepage against this system.

---

*This document is the single source of truth for all future HSS website work.*
---
name: Trench Warfare Aesthetics
colors:
  surface: '#0c1609'
  surface-dim: '#0c1609'
  surface-bright: '#323c2d'
  surface-container-lowest: '#071105'
  surface-container-low: '#141e11'
  surface-container: '#182214'
  surface-container-high: '#222d1e'
  surface-container-highest: '#2d3828'
  on-surface: '#dae6d0'
  on-surface-variant: '#baccb0'
  inverse-surface: '#dae6d0'
  inverse-on-surface: '#293324'
  outline: '#85967c'
  outline-variant: '#3c4b35'
  surface-tint: '#2ae500'
  primary: '#efffe3'
  on-primary: '#053900'
  primary-container: '#39ff14'
  on-primary-container: '#107100'
  inverse-primary: '#106e00'
  secondary: '#ffb3b1'
  on-secondary: '#680011'
  secondary-container: '#ff535a'
  on-secondary-container: '#5b000e'
  tertiary: '#fff9f0'
  on-tertiary: '#3a3000'
  tertiary-container: '#ffdb40'
  on-tertiary-container: '#736000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#79ff5b'
  primary-fixed-dim: '#2ae500'
  on-primary-fixed: '#022100'
  on-primary-fixed-variant: '#095300'
  secondary-fixed: '#ffdad8'
  secondary-fixed-dim: '#ffb3b1'
  on-secondary-fixed: '#410007'
  on-secondary-fixed-variant: '#92001c'
  tertiary-fixed: '#ffe16d'
  tertiary-fixed-dim: '#e9c400'
  on-tertiary-fixed: '#221b00'
  on-tertiary-fixed-variant: '#544600'
  background: '#0c1609'
  on-background: '#dae6d0'
  surface-variant: '#2d3828'
  trench-black: '#0D0D0A'
  mud-brown: '#2A241A'
  sandbag: '#5C5244'
  gas-mask-grey: '#8B8B7A'
  wood-plank: '#5C3A21'
  wood-shadow: '#3A2512'
typography:
  headline-xl:
    fontFamily: Anybody
    fontSize: 48px
    fontWeight: '800'
    lineHeight: '1.1'
    letterSpacing: 0.05em
  headline-lg:
    fontFamily: Anybody
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  headline-md:
    fontFamily: Anybody
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  body-lg:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Space Mono
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.2'
  meme-quote:
    fontFamily: Syne
    fontSize: 20px
    fontWeight: '800'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 16px
  margin-mobile: 12px
  margin-desktop: 32px
---

# ShitMarket.gg — Frontend Design Spec

## Project Overview
**ShitMarket** is a PvP prediction market for meme coins. Users bet on whether a token will pump (Moon) or dump (Jeet) within a short timeframe. No actual token purchases—just pure degenerate gambling. The platform takes a 2% fee from the total pot.

**Domain:** shitmarket.gg  
**Target:** Mobile-first, but fully responsive.  
**Tone:** Dark humor, trench warfare + meme culture. Anti-corporate.  
**Goal:** Gamified, chaotic, and sticky.

---

## Tech Stack (for code generation)
- **Framework:** React (Next.js App Router recommended, but plain React acceptable)
- **Styling:** Tailwind CSS + custom CSS for extreme degen effects
- **Animations:** Framer Motion (for screen shake, confetti, transitions)
- **State:** React Context + useReducer (or Zustand) for mock betting state
- **Icons:** Lucide React + custom pixel-art SVGs (provide inline)
- **Fonts:** 
  - Headings: `'Staatliches'` (Google Fonts) — bold, stencil-like
  - Body: `'JetBrains Mono'` — gritty monospace
  - Memes: `'Comic Neue'` or `'Permanent Marker'` for degen quotes

---

## Design System

### Color Tokens
| Token             | Hex       | Usage                           |
|-------------------|-----------|----------------------------------|
| Trench Black      | `#0D0D0A` | Main background                 |
| Mud Brown         | `#2A241A` | Cards, panels, bunkers          |
| Neon Moon (Green) | `#39FF14` | MOON side, gains, CTA flares    |
| Jeet Red          | `#FF073A` | JEET side, losses, alerts       |
| Moon Gold         | `#FFD700` | Winnings, ranks, highlights     |
| Sandbag           | `#5C5244` | Borders, secondary elements     |
| Gas Mask Grey     | `#8B8B7A` | Inputs, disabled states         |

### Typography
- **H1–H3:** `font-family: 'Staatliches', sans-serif; text-transform: uppercase; letter-spacing: 0.05em;`
- **Body/Data:** `font-family: 'JetBrains Mono', monospace; font-size: 0.875rem;`
- **Meme Quotes:** `font-family: 'Permanent Marker', cursive; color: #FFD700;`

### Component Aesthetics
- **Cards:** `.bg-mud-brown border-2 border-sandbag rounded-lg shadow-lg` with a subtle inner shadow for "bunker" feel.
- **Buttons:** Styled as wooden planks (`.bg-[#5C3A21] border-b-4 border-[#3A2512] text-white font-bold`) or glowing flares (`.bg-neon-moon text-black font-bold rounded-full shadow-[0_0_15px_#39FF14]`).
- **Inputs:** `.bg-trench-black border-2 border-gas-mask-grey text-white placeholder-gray-500 rounded` — think ammo crates.
- **Badges:** Pixel-art styled, using `border-2 border-dashed` and monospace font.

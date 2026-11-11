---
name: Sapphire Precision Document Engine
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#ad0033'
  on-tertiary: '#ffffff'
  tertiary-container: '#d22348'
  on-tertiary-container: '#ffecec'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-lg:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  gutter-desktop: 1.25rem
  margin: 1rem
  margin-mobile: 0.75rem
  margin-desktop: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

The design system establishes a high-performance, distraction-free environment for professional document editing, PDF markup, and precision typographic publishing on mobile form factors. 

### Brand Personality & Emotional Impact
- **Surgical Precision:** Every control, ruler, line guide, and selection handle communicates exactness without visual clutter.
- **Cognitive Clarity:** Dense desktop-class functionality is condensed into clean touch targets, eliminating editing fatigue.
- **Trustworthy Authority:** Structured, architectural slate tones evoke the reliability of enterprise-grade publishing infrastructure.

### Design Aesthetic: Precision Functionalism
The interface blends contemporary corporate minimalism with refined tactile affordances optimized for direct touch manipulation:
- Crisp 1px structural outlines replace heavy drop shadows.
- Micro-frosted bottom sheets anchor toolbars without obstructing underlying content.
- Clean vector icons (Heroicons/Lucide geometric aesthetic) provide immediate semantic recognition; no emojis or non-system decorative glyphs.

## Colors

The palette balances intense sapphire focus tones against calibrated slate neutrals to support long editing sessions and distinct visual layers.

### Color Roles & Semantics
- **Primary Sapphire (`#2563EB`, active `#1D4ED8`):** Drives interactive states, primary action bars, selection handles, active annotations, and caret color.
- **Secondary Warm Amber (`#F59E0B`):** Reserved for contextual warnings, document changes needing review, version drift, and low-priority alerts.
- **Tertiary Soft Coral (`#F43F5E`):** Applied exclusively to destructive actions, redaction modes, validation errors, and critical document conflict notifications.
- **Neutral Slate Foundation (`#0F172A` deep ink, `#1E293B` structural slate, `#334155` muted labels):** Establishes hierarchy across toolbars, inspector panels, and body typography.

### Theme Handling
- **Light Canvas Mode:** Primary background `#F8FAFC`, surface elevated `#FFFFFF`, hairline divider `#E2E8F0`. Document sheet renders pure white (`#FFFFFF`) with a subtle 1px border (`#E2E8F0`) to delineate margins against the slate canvas backdrop.
- **Dark Workspace Mode:** App viewport `#0B0F19`, floating toolbars and sheets `#111827`, borders and separators `#1E293B`, and muted text `#94A3B8`. Document paper provides an optional inverted or true-paper display mode.

## Typography

The type system pairs **Plus Jakarta Sans** for structural UI framing, navigation, and modal headers with **Inter** for document inspector controls, tool labels, and body copy.

### Functional Roles
- **Headlines (Plus Jakarta Sans):** Geometric clarity and open apertures maintain legibility on compact displays and top navigation bars.
- **Interface & Metrics (Inter):** Highly legible tabular numerals and neutral grotesque shapes ensure precise rendering for font size pickers, point/pica coordinates, page numbers, and list indices.
- **Optical Adjustments:** High-density tool ribbons use tight vertical metrics with uppercase tracking (`+0.04em` on `label-sm`) to maximize horizontal screen real estate on mobile viewports.

## Layout & Spacing

The spatial engine utilizes an 8px base rhythm with 4px sub-increments for compact tool clusters and touch-target padding.

### Mobile-First Layout Model
- **Document Stage:** Fluid viewport centering the rendered page with minimum outer margins of `0.75rem` (`margin-mobile`), scaling up to `1.5rem` (`margin-desktop`) on tablets or external displays.
- **Top Command Bar:** Fixed 52px height accommodating document title, undo/redo stack, export engine, and view mode toggles.
- **Contextual Ribbon & Bottom Sheet:** Dynamic bottom docked zone preserving 48px minimum touch targets, adapting above OS home indicators via environmental safe-area insets.
- **Inspector Grids:** Tool attribute panels utilize 2-column and 4-column balanced micro-grids with `0.75rem` gutters to pack typography weights, alignments, and color swatches within thumb reach.

## Elevation & Depth

Visual hierarchy prioritizes content legibility over dramatic drop shadows. Separation is generated through subtle boundary strokes and low-diffusion ambient occlusion.

### Surface Tiers
- **Layer 0 (Canvas Base):** Background workspace rendered in `#F8FAFC` (Dark: `#0B0F19`).
- **Layer 1 (The Document Paper):** Grounded elevation using a single 1px hairline border (`#E2E8F0` / dark: `#1E293B`) paired with a micro-drop shadow: `0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)`.
- **Layer 2 (Floating Action Bars & Palettes):** Persistent floating quick-bars leverage frosted glass (`backdrop-filter: blur(12px)`) with 90% opacity fill (`#FFFFFFE6` / dark: `#111827E6`), bounded by a 1px border (`#E2E8F0` / dark: `#1E293B`) and ambient soft lift: `0 8px 24px -4px rgba(15, 23, 42, 0.08)`.
- **Layer 3 (Modal Sheets & Context Menus):** Interactive bottom sheets use a high-order ambient shadow `0 20px 32px -8px rgba(15, 23, 42, 0.16)` alongside a dark backdrop overlay (`rgba(15, 23, 42, 0.45)`).
- **Layer 4 (System Toasts & Carets):** Pure surface elevation positioned above editing canvases with a tight ring boundary: `0 10px 15px -3px rgba(15, 23, 42, 0.12)`.

## Shapes

The geometric framework balances functional software rigor with touch comfort. 

### Corner Radius System
- **Base Element Radius (0.5rem):** Standardized across text inputs, dropdown selectors, tool toggles, and contextual action buttons.
- **Panels & Bottom Sheets (1rem to 1.5rem):** Bottom sheets feature `rounded-t-2xl` (1rem) for an organic swipe gesture surface. Floating modal dialogs use `rounded-xl` (1rem).
- **Inline Pill Modifiers:** Used exclusively for notification toasts, selection count pills, annotation tags, and active format switches (`rounded-full`).

## Components

### Buttons & Quick Actions
- **Primary Tool Button:** Solid sapphire background (`#2563EB`), text `#FFFFFF`, 44px minimum height, 10px inner horizontal padding. Active state scales to 0.98 with `#1D4ED8`.
- **Secondary / Ghost Icon Controls:** Neutral slate icon (`#334155`), background transparent. Active/selected state displays `#EFF6FF` background with `#2563EB` icon color and 1px `#DBEAFE` border.
- **Destructive Actions:** Soft coral text (`#F43F5E`) on transparent base; confirmed destruction switches to solid fill with white glyphs.

### Bottom Sheets (Touch-Optimized Tooling)
- Fitted with a 36px wide by 4px high drag pill (`#CBD5E1`) centered at the top.
- Multi-snap breakpoints: collapsed (64px single-row formatting ribbon), expanded (50% viewport for font/style selectors), and full-height (page thumbnail grid and structural bookmarks).
- Content sections inside bottom sheets use segmented dividers (`1px solid #F1F5F9`).

### Input Fields & Steppers
- **Numerical Dimension/Size Inputs:** Fixed height of 40px, embedded stepper buttons (`-` and `+`) flanking the value with tabular figures. 1px border `#CBD5E1`, transitioning to sapphire outline on focus with zero offset.
- **Font Search & Text Replacement:** 40px height with embedded vector magnifying glass, slate `#64748B` placeholder, and instant clear button (`X`).

### Chips, Badges & Toggles
- **Format Chips (Bold, Italic, Strikethrough, Underline):** Grouped into segmented pill containers with 2px inner padding. Selected items pop with white background and subtle ambient shadow.
- **Status Badges:** Compact height (20px), `label-sm` tracking, rounded-full. Amber variant (`#FEF3C7` background with `#B45309` text) indicates uncommitted track changes.

### Checkboxes, Radios & Switches
- **Checkboxes:** 20x20px, 4px corner radius. Unchecked: 1.5px border `#94A3B8`. Checked: solid `#2563EB` fill with crisp white vector checkmark.
- **Switches (Feature toggles):** 44x24px pill container with an embedded 20px white thumb shifting smoothly via spring curve over 150ms.

### Toasts & Floating Feedback
- Anchored at bottom-center (80px clearance from canvas bottom to clear bottom bars).
- Compact horizontal layout, maximum width 360px, rounded-full geometry.
- Dark slate surface (`#0F172A`) with high-contrast white text, leading icon indicator, and optional trailing inline sapphire action button (e.g., "UNDO").

### Selection Handles & Loupes
- **PDF Selection Handles:** 12px circular anchors in primary sapphire (`#2563EB`) with a 2px white outline and connected 1.5px vertical caret marker.
- **Magnification Loupe:** 80px circular preview hovering 48px above finger touch position, encased in a 2px slate border with 1.25x pixel-aligned zoom.
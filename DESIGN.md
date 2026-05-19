---
name: Apex
description: Personal performance optimization dashboard — clinical precision in a warm shell.
colors:
  warm-cinder: "#302b25"
  deep-amber-clay: "#38302a"
  dark-forge-brown: "#201c18"
  ash-oak: "#454038"
  warm-bone: "#f5f0eb"
  faded-linen: "#ccc4bc"
  signal-orange: "#f97316"
  performance-green: "#22c55e"
  alert-coral: "#ff6b6b"
  ghost-border: "rgba(255,255,255,0.10)"
typography:
  display:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Barlow Condensed, Barlow, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  title:
    fontFamily: "Barlow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Barlow, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Barlow, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.1em"
rounded:
  sm: "7px"
  md: "10px"
  lg: "12px"
  xl: "17px"
  "2xl": "22px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-orange}"
    textColor: "#0d0c0b"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "#ea6c12"
    textColor: "#0d0c0b"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.faded-linen}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  card-default:
    backgroundColor: "{colors.deep-amber-clay}"
    textColor: "{colors.warm-bone}"
    rounded: "{rounded.xl}"
    padding: "16px"
  nav-item-active:
    backgroundColor: "rgba(249,115,22,0.15)"
    textColor: "{colors.signal-orange}"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  nav-item-default:
    backgroundColor: "transparent"
    textColor: "rgba(245,240,235,0.4)"
    rounded: "{rounded.lg}"
    padding: "10px 12px"
  badge-green:
    backgroundColor: "rgba(34,197,94,0.15)"
    textColor: "{colors.performance-green}"
    rounded: "{rounded.xl}"
    padding: "2px 8px"
  badge-orange:
    backgroundColor: "rgba(249,115,22,0.15)"
    textColor: "{colors.signal-orange}"
    rounded: "{rounded.xl}"
    padding: "2px 8px"
---

# Design System: Apex

## 1. Overview

**Creative North Star: "The Performance Lab"**

Apex is instrumentation, not an application. Every screen exists to surface one answer fast: what does my body need right now? The aesthetic is clinical but not cold — warm-toned materials (brown, bone, amber) stand in for the stainless steel of an actual lab. Numbers are the primary design element; spacing, typography, and hierarchy exist only to make them scannable in under two seconds.

The system rejects everything that dilutes signal: no background illustrations, no achievement iconography, no encouraging microcopy that restates what the data already says. Information density is a feature, not a problem to solve. Cards are grouping devices, not decorative containers. Glow is reserved for live state and alert, never ornament.

This is a tool for one person who understands what HRV, strain, and sleep performance mean. It does not explain. It does not celebrate. It reports.

**Key Characteristics:**
- Warm-brown dark palette grounded by a single orange accent at ≤15% surface coverage
- Condensed bold numerals (Barlow Condensed 700) as the dominant visual element
- Flat tonal layering for depth; no drop shadows
- Uppercase micro-labels (10px, 700 weight, tracked wide) as the taxonomic layer
- All interactive elements navigate to detail; the dashboard surface never expands inline

## 2. Colors: The Warm Instrument Palette

A single warm-brown dark surface with one high-signal accent and two semantic status colors. Every tint is brown-shifted; no cool greys anywhere.

### Primary
- **Signal Orange** (#f97316): The only accent. Used for active nav states, primary CTAs, icon fills on primary metrics, progress bar fills when incomplete, and focus rings. Never more than 15% of any screen surface. Its scarcity is the signal.
- **Performance Green** (#22c55e): Semantic positive state: goal achieved, green recovery zone, completed supplements, protein target met. Not decorative.

### Tertiary
- **Alert Coral** (#ff6b6b): Destructive actions and below-threshold values only. Red recovery zone, error states.

### Neutral
- **Warm Cinder** (#302b25): Page background. The ground surface all content sits on.
- **Deep Amber Clay** (#38302a): Card and container backgrounds. Sits exactly one tonal step above Warm Cinder, creating hierarchy without shadows.
- **Dark Forge Brown** (#201c18): Sidebar and nav rail background. The deepest surface.
- **Ash Oak** (#454038): Secondary/muted surface fill (inputs, progress track, chip backgrounds). Also the secondary/muted token.
- **Warm Bone** (#f5f0eb): Primary foreground text. Warm off-white, never pure white.
- **Faded Linen** (#ccc4bc): Secondary text, muted labels, sub-values. Passes WCAG AA at all sizes on card and background surfaces.
- **Ghost Border** (rgba(255,255,255,0.10)): Divider lines and card borders. Structural, not decorative.

### Named Rules
**The One Accent Rule.** Signal Orange is the only non-semantic color on any given screen. Multi-color status indicators (yellow, blue, red per-metric) are semantic data, not decoration. Never introduce a second decorative accent.

**The Warm-Only Rule.** Every neutral is brown-shifted. Cool greys (zinc, slate) are prohibited; they flatten the material quality of the palette.

## 3. Typography

**Primary Font:** Barlow Condensed (metrics, display numerals, section totals)
**Secondary Font:** Barlow (labels, body, navigation, descriptions)

**Character:** A dual-axis system: Barlow Condensed carries urgency and density for data; Barlow regular carries legibility and calm for everything else. Together they separate "what happened" (the number) from "what it means" (the label).

### Hierarchy
- **Display** (Barlow Condensed 700, ~48–72px, lh 1): Hero numerals only. Days-to-event count. Rare; one per screen maximum.
- **Headline** (Barlow Condensed 700, 1.875rem/30px, lh 1): Primary metric values on cards. Steps count, weight, protein grams, recovery score. The dominant visual element.
- **Title** (Barlow 600, 0.875rem/14px, lh 1.4): Section headings, card titles, nav labels.
- **Body** (Barlow 400, 0.875rem/14px, lh 1.5): Descriptions, insight text, contextual notes. Max line length 65ch.
- **Label** (Barlow 700, 0.625rem/10px, lh 1, tracking 0.1em, uppercase): Card category labels, metric sub-labels ("P", "C", "F", "HRV ms", "aim 8h"). The taxonomic layer.

### Named Rules
**The Condensed-for-Numbers Rule.** Every numeric value larger than body text uses Barlow Condensed. Barlow regular is for prose. Never use regular weight for headline-scale numbers.

**The Scale Gap Rule.** Labels (10px) and body (14px) have a 1.4× step. Headline (30px) and body (14px) have a 2.1× step. Hierarchy is visible. A flat scale where everything is 14px is prohibited.

## 4. Elevation

Apex uses tonal layering exclusively. No drop shadows on resting surfaces.

Depth is conveyed through three tonal steps:
1. **Dark Forge Brown** (#201c18) — deepest; nav rail/sidebar
2. **Warm Cinder** (#302b25) — page background
3. **Deep Amber Clay** (#38302a) — cards and containers

A card is visible because its background is one tonal step lighter than the page, bounded by a Ghost Border (rgba(255,255,255,0.10)). No shadow needed.

### Shadow Vocabulary
- **Accent Glow** (`box-shadow: 0 0 24px rgba(249,115,22,0.25)`): Applied to primary CTA buttons and active metric cells on hover. Communicates live state, not permanent decoration.
- **Green Glow** (`box-shadow: 0 0 24px rgba(34,197,94,0.25)`): Applied to goal-complete states. Same logic as Accent Glow.

### Named Rules
**The Flat-By-Default Rule.** No surface has a shadow at rest. Shadow appears only as an interaction response or semantic alert. If you're reaching for a shadow to separate a card from the page, use tonal layering instead.

## 5. Components

### Buttons
- **Shape:** Gently rounded (12px / 0.75rem). Not pill-shaped; not square.
- **Primary:** Signal Orange background (#f97316), near-black text (#0d0c0b), 10px 20px padding. Hover: darkens to ~#ea6c12, subtle orange glow.
- **Ghost / Secondary:** Transparent background, Faded Linen text, 1px Ghost Border. Hover: Ash Oak background fill.
- **Destructive:** Alert Coral background on hover; default ghost state.
- **Disabled:** 30% opacity; no pointer-events.

### Cards / Containers
The primary grouping unit. Not decorative containers.
- **Background:** Deep Amber Clay (#38302a)
- **Border:** Ghost Border (rgba(255,255,255,0.10)), 1px
- **Corner Style:** Gently rounded (16–17px / rounded-2xl)
- **Internal Padding:** 16px (p-4) standard; 20px (p-5) for featured/hero cards
- **Hover State:** Border shifts to rgba(255,255,255,0.20) on navigable cards. No shadow.
- **Nested cards are prohibited.** A card's internal content is a flat grid, not sub-cards.

### Metric Display
The signature component. Appears on every content card.
- **Primary value:** Barlow Condensed 700, 30px, leading-none, colored per semantic role (Signal Orange for nutrition/primary, Performance Green for achieved goals, status colors for WHOOP data)
- **Unit label:** Barlow 700, 10px, uppercase, Faded Linen, margin-left 2px
- **Category label:** Barlow 700, 10px, uppercase, tracking wide, Faded Linen — sits above the metric
- **Icon badge:** 28px square, rounded-lg, colored at 10% opacity background matching the metric color, icon at 14px

### Progress Bars
- **Track:** Ash Oak/white at 5% opacity, height 6px (primary) or 4px (secondary), fully rounded
- **Fill:** Signal Orange when incomplete; Performance Green when at or above target
- **No animated shimmer.** State changes only on data update.

### Navigation
- **Desktop sidebar:** Dark Forge Brown background, 176px wide, sticky. Items: 14px Barlow 500.
- **Active state:** Signal Orange background at 15% opacity, Signal Orange text, icon strokeWidth 2.5.
- **Inactive state:** Warm Bone at 40% opacity, icon strokeWidth 1.75. Hover shifts to 80% opacity.
- **Mobile bottom nav:** Fixed, Warm Cinder background at 95% + backdrop-blur. Same active/inactive rules. Tab labels 10px.

### Badges / Pills
- **Semantic:** Small pill (rounded-full), colored text with 15% opacity matching background. Green/Yellow/Red for status values (recovery zone). Orange for primary contextual tags.
- **Border:** 1px solid, matching text color at 30% opacity.
- **Never decorative.** Badges carry data (recovery zone, progress %) not labels.

### Week Strip
The date-navigation component at the top of the dashboard.
- **Selected today:** Signal Orange background at 15%, orange border at 30%, orange text.
- **Selected future date:** Sky blue background/border/text (semantic: looking ahead, not current).
- **Past days:** Muted foreground text; recovery dot colored per WHOOP score.
- **Future days beyond +7:** 25% opacity; no interaction.

## 6. Do's and Don'ts

### Do:
- **Do** use Barlow Condensed 700 for every numeric value ≥1.5rem. Numbers are the interface.
- **Do** keep cards flat: `bg-card border border-border rounded-2xl p-4`. No shadow at rest.
- **Do** use semantic colors only for their defined meaning: green = achieved/positive, orange = primary/incomplete, coral = error/destructive, yellow = caution.
- **Do** use uppercase micro-labels (10px, 700, tracking-wide) for all card category headings and metric unit suffixes.
- **Do** express hover states through border opacity shift (`border-white/20`) and accent glow on primary elements. No movement on hover for cards.
- **Do** use `text-muted-foreground`, `bg-muted`, `bg-card`, `border-border` Tailwind tokens. Never hardcode brown hex values in component classes.
- **Do** honor `prefers-reduced-motion` by skipping all transitions and animations.

### Don't:
- **Don't** introduce dense sidebar nav overload. The navigation has five items maximum. No nested sub-nav, no "enterprise widget" patterns (Salesforce / HubSpot anti-reference).
- **Don't** add achievement badges, streak counters, gamification iconography, or motivational filler copy. This is not MyFitnessPal.
- **Don't** show twelve metrics per screen with no hierarchy. Every screen has one primary metric. Supporting data is secondary. Nothing competes. (Oura/Levels data-dump anti-reference.)
- **Don't** use cool greys (zinc-*, slate-* Tailwind utilities). All neutrals are warm-brown. `text-zinc-400` violates the palette immediately.
- **Don't** use gradient text (`background-clip: text`). Metric values are solid single-color.
- **Don't** use side-stripe borders (`border-left` > 1px as a colored accent). Rewrite with background tint or full border.
- **Don't** build nested cards. A card's content area is flat. No `bg-card/50` sub-containers inside another card.
- **Don't** use violet, purple, or blue as decorative accents. Blue and sky are reserved for semantic "future date" state only. Purple appears only in the Target Event card (a deliberate one-off, not a system color).
- **Don't** add blur-based glassmorphism decoratively. `backdrop-blur` is used on the mobile nav for practical legibility, not aesthetic effect.
- **Don't** use the hero-metric template (big number, small label, gradient accent, supporting stats ring). The metric card pattern is flat grid, not circular gauge with glow ring.

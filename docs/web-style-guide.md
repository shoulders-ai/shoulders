# Shoulders — Website Style Guide

Reference document for the website design system (./web/*)
See `docs/brand.md` for full brand identity, voice, and emotional register.

---

## Typography

Two fonts. Crimson Text (serif) for headings and the brand name. Open Sans (sans-serif) for everything else.

### Scale

Every text element on the site uses one of these sizes. No arbitrary `text-[Npx]` values.

| Class      | Size   | Use                                           |
|------------|--------|-----------------------------------------------|
| `text-xs`  | 11px   | Labels, meta, uppercase section markers       |
| `text-sm`  | 13px   | Navigation, secondary text, table cells       |
| `text-base`| 15px   | Body copy, feature descriptions               |
| `text-lg`  | 18px   | Lead paragraphs, large body text              |
| `text-xl`  | 24px   | Small headings, logo wordmark                 |
| `text-2xl` | 32px   | Section headings (h2)                         |
| `text-3xl` | 44px   | Page headings, hero (mobile/tablet)           |
| `text-4xl` | 56px   | Hero heading (desktop only)                   |

Each size includes a tuned `line-height` and `letter-spacing` in `tailwind.config.js`.

### Rules

- Headings: `font-serif font-semibold tracking-tight text-stone-900`
- Body: `font-sans text-stone-600 leading-relaxed`
- Section labels: `text-xs font-semibold uppercase tracking-[0.15em] text-cadet-500`
- Navigation: `text-sm text-stone-600 hover:text-stone-900 tracking-wide`
- Never use `font-bold` — only `font-medium` (500) and `font-semibold` (600)

---

## Color

Near-monochrome. The site should feel like a well-typeset academic publication, not a SaaS dashboard.

### Palette

| Role             | Token(s)                | Use                                        |
|------------------|-------------------------|--------------------------------------------|
| **Text primary** | `stone-900`             | Headings, buttons, emphasis                |
| **Text body**    | `stone-600`             | Paragraphs, descriptions                   |
| **Text muted**   | `stone-400`             | Secondary info, labels, navigation idle    |
| **Text faint**   | `stone-300`             | Metadata, attribution, disabled            |
| **Borders**      | `stone-100`, `stone-200`| Section dividers, card borders             |
| **Background**   | `white`                 | Page background                            |
| **Accent**       | `cadet-500`             | Section labels only (small, uppercase)     |
| **Success**      | `sea-500`               | Checkmarks in comparison table             |
| **Buttons**      | `stone-900` / `stone-800` hover | All primary CTAs                  |

### What NOT to do

- No `cadet-*` on buttons — that reads as "SaaS product"
- No `bg-stone-50` or `bg-stone-100` section backgrounds — keep everything white
- No gradients, no colored borders, no shadows (except on product screenshots)
- Cadet blue appears ONLY as the small section label text (`text-cadet-500`)

---

## Spacing

Generous vertical rhythm. Sections should breathe.

| Context            | Spacing                         |
|--------------------|---------------------------------|
| Section padding    | `py-24 md:py-32`               |
| Between heading and body | `mt-5`                   |
| Between elements   | `gap-10` or `gap-12`           |
| Max content width  | `max-w-6xl` (features, pillars)|
| Max text width     | `max-w-3xl` (hero), `max-w-2xl` (quote, CTA) |
| Max table width    | `max-w-4xl`                    |

---

## Buttons

Two styles only.

### Primary (Download, Sign up)
```
bg-stone-900 hover:bg-stone-800 text-white font-medium rounded tracking-wide
```
Large variant adds `px-6 py-2.5 text-base`. Standard: `px-5 py-2 text-sm`.

### Secondary (text link style)
```
text-stone-600 hover:text-stone-900 transition-colors
```

No outlined buttons, no ghost buttons, no colored buttons.

---

## Logo Bar

Institution logos are displayed as monochrome images with equal visual weight.

### Treatment
- `filter: grayscale(100%)`
- `opacity: 0.35`
- Hover: `opacity: 0.55` (subtle, not dramatic)

### Area Equalization

Logos vary in aspect ratio (some are tall emblems, some are wide wordmarks). To make them *feel* equal in weight, we normalize by visual area rather than height:

```js
width = Math.pow(naturalWidth / naturalHeight, 0.525) * widthBase
```

This formula gives wider logos proportionally more width, but compressed by the 0.525 exponent so they don't dominate. Applied via `@load` handler on each `<img>`.

---

## Comparison Table

- Title: descriptive, not clever ("What researchers use today")
- "The usual way" column accumulates tool names — this IS the argument
- "With Shoulders" column: clean checkmarks, 3-4 selective qualifiers on strongest differentiators
- Punchline below: "That's 15+ applications. Or one."

---

## Imagery

### Product Screenshots
- Dark rounded rectangles (`bg-stone-900 rounded-lg`)
- These are the only elements that may have subtle `shadow-xl`
- Placeholder until real assets exist

### Newton Quote Section
- Full-bleed background: `wide-land.jpg` (Wanderer über dem Nebelmeer landscape)
- Warm dark overlay: `stone-950` at ~68% opacity
- Quote in white/off-white, serif italic
- Attribution in white at low opacity

---

## Component Patterns

### Section Label
```html
<p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-4">Label</p>
```

### Section Heading
```html
<h2 class="text-2xl md:text-3xl font-serif font-semibold leading-tight tracking-tight text-stone-900">
```

### Body Copy
```html
<p class="mt-5 text-base text-stone-600 leading-relaxed">
```

### Feature Card
```html
<div class="border-t border-stone-200 pt-6 pb-10">
  <Icon :size="18" class="text-stone-400 mb-3" :stroke-width="1.5" />
  <h3 class="text-base font-semibold text-stone-900 tracking-tight">Title</h3>
  <p class="mt-2 text-sm text-stone-600 leading-relaxed">Description</p>
</div>
```

---

## No List

Things this site does not use:
- Animations or transitions (except hover color changes)
- Shadows (except on product screenshots)
- Gradients (except the quote section overlay)
- Dark mode
- Colored backgrounds
- Rounded-full pills
- Badge/tag components
- Exclamation marks in copy

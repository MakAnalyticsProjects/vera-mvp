# Vera Calloway — Landing Demo Design

## Mood

Warm fintech. Quiet authority. The opposite of a SaaS sizzle reel — measured pacing, generous whitespace, considered typography. Vera is observant, not flashy. Animations breathe; nothing whips across the frame.

## Theme

Light.

## Palette

Sampled from `apps/web/app/globals.css` — the source of truth for the product.

| Token            | Hex      | Role                                                     |
| ---------------- | -------- | -------------------------------------------------------- |
| `bg-base`        | `#f5efe6` | Page background (warm cream)                             |
| `bg-card`        | `#fffcf7` | Card / panel surfaces                                    |
| `bg-subtle`      | `#ece4d3` | Recessed shapes                                          |
| `text-primary`   | `#1f1b16` | Headlines, body                                          |
| `text-secondary` | `#6e6258` | Captions, secondary copy                                 |
| `text-muted`     | `#9c8e80` | Eyebrows, hints                                          |
| `border`         | `#e8decf` | Hairlines                                                |
| `accent`         | `#c8854e` | Terracotta — Vera's signature color, primary highlight   |
| `accent-soft`    | `#e8c5a0` | Tinted backgrounds                                       |
| `heat-cool`      | `#7a8f6f` | Sage — "within terms" / paid                             |
| `heat-warm`      | `#c9a05f` | Amber — 1–30 days                                        |
| `heat-hot`       | `#c8714c` | Burnt — 31–60 days                                       |
| `heat-critical`  | `#a14535` | Deep red — 60+ days / critical                            |
| `info`           | `#5c7e9c` | Slate blue — the one cool tone, informational            |

All hex values must come from this list. No invented colors.

## Typography

- **Display:** `Fraunces` (variable serif, low contrast, friendly). Fall back chain: `'Newsreader', 'Source Serif Pro', Georgia, serif`. Display sizes 80–160px depending on scene. Letter-spacing tight (-0.01em).
- **Sans:** `Inter`. Eyebrows tracked +0.2em, uppercase, 24–30px. Body 36–48px.
- **Numeric data:** `font-variant-numeric: tabular-nums` whenever dollar figures or bucket counts are shown so they don't jitter.

## Corners

`24px` (= product's `--radius-card: 1.25rem`) for cards. `999px` for pills.

## Spacing

Generous. Padding inside cards: 56–80px. Gap between sibling cards: 32–48px. Page padding: 160px sides, 120px top/bottom on a 1920×1080 canvas.

## Depth

Subtle. One soft shadow ring max per surface — `0 8px 24px -6px rgba(31, 27, 22, 0.10)`. No glows. No layered drop-shadow stacks. The cream palette does the work; shadows are accents, not structure.

## Motion

- **Eases:** lean on `power3.out`, `expo.out`, `power2.out` for entrances. Avoid linear and avoid bounce.
- **Durations:** entrances 0.5–0.8s. Crossfades between scenes 0.5s.
- **Pace:** unhurried. Holds of 2–3 seconds at the readable moment of every scene. No element jitters or pulses unless it carries narrative meaning (e.g., a single "HOT" pill bloom).
- **Stagger:** 80–120ms between sibling pills/cards.

## Voice

If captions or pulled quotes appear, write them in Vera's voice — observational, first-person, considerate. Examples from the product itself:

- "I keep an eye on the money that hasn't come home yet."
- "Every morning, I bucket what's overdue."
- "I draft the follow-up before you ask."
- "Trust before autonomy."

Never use marketing tropes ("Unlock", "Supercharge", "Revolutionize"). Vera does not sell — she reports.

## What NOT to Do

- No gradients across the full background. Cream is the bed.
- No drop shadows stacked beyond one. No glows on light surfaces.
- No emoji. No exclamation points.
- No "growth chart goes up" stock motifs.
- No saturated blue or pure black. `#000` is forbidden — use `text-primary` `#1f1b16`.
- No frenetic motion. No bounce eases. No multiple things animating in different directions at once.
- No exit animations on intermediate scenes — the crossfade IS the exit.

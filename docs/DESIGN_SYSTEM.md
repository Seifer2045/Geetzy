# Design System (code) — from Figma "v2 – Premium"

Source of truth in code: `mobile/src/theme/tokens.ts`. Never hardcode hex or spacing in screens.

## Tokens

### Colors
| Token | Value | Use |
|---|---|---|
| `bg` | `#0A0A0F` | app background |
| `surface` | `#14121C` | sheets, sticky footers, tab bar |
| `glass` | `rgba(255,255,255,0.06)` | cards, inputs, chips |
| `border` | `rgba(255,255,255,0.09)` | 1px borders on glass |
| `text` | `#FFFFFF` | primary text |
| `textSecondary` | `#C9C3DA` | chip labels, secondary |
| `muted` | `#9A93B0` | captions, hints |
| `faint` | `#7D7790` | inactive tab, placeholders |
| `pink` / `pinkSoft` | `#FF4D8D` / `#FF7AA8` | brand, links |
| `violet` | `#7C5CFF` | brand end |
| `gold` | `#FFC857` | price, offers, badges |
| `success` / `danger` | `#2BD97C` / `#FF5C5C` | status |

**Brand gradient:** `#FF4D8D → #C04CF0 → #7C5CFF` (left → right).

### Typography — Inter
| Variant | Size / weight | Letter spacing |
|---|---|---|
| `display` | 30 / Bold | −3% |
| `h1` | 28 / Bold | −3% |
| `h2` | 24 / Bold | −3% |
| `h3` | 20 / SemiBold | −1% |
| `title` | 17 / SemiBold | 0 |
| `body` | 15 / Medium | 0 |
| `bodySm` | 13 / Regular | 0 |
| `caption` | 12 / Medium | 0 |
| `overline` | 11 / SemiBold, UPPERCASE | +6% |
| `micro` | 10 / SemiBold | +4% |

### Spacing · Radius
Spacing: `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32` (screen padding = 20).
Radius: `sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · pill 999`.

### Motion (Reanimated)
| Token | Value | Use |
|---|---|---|
| `enter` | 300 ms, ease-out-quad, translateY 12 → 0 | content enter |
| `stagger` | 100 ms (60 ms for grids) | between groups |
| `exit` | 150 ms, translateY 0 → −12 | content exit |
| `press` | scale 0.97, 120 ms | every pressable |
| `iconSwap` | scale 0.25 → 1 + opacity, spring no bounce | heart, play/pause |

Rules: no bounce/overshoot (except the splash logo pop), interruptible shared-value
animations for interactive state, respect **Reduce motion** (`useReducedMotion`).

## Components (`mobile/src/components`)
| Component | Variants / props | Notes |
|---|---|---|
| `Button` | `primary` (gradient + glow), `glass`, `light` (white), `ghost`; `loading`, `disabled`, `icon` | 56 px, radius 16, haptic on primary |
| `PressableScale` | `scaleTo` | base of all tappables |
| `GlassCard` | `padding`, `radius`, `tone` | glass surface |
| `Chip` | `selected`, `icon`, `count` | filters, mood, singer |
| `Segmented` | `options`, `value` | AI song / My song |
| `TopBar` | `title`, `step (1–4)`, `right` | back + progress pills |
| `Input` | `label`, `prefix` | uppercase label, glass field |
| `TemplateCard` | `template`, `width`, `height`, `showPrice` | gradient thumb, badge, play |
| `TabBar` | custom bottom tabs | Home · Explore · ＋ · Library · Profile |
| `StickyFooter` | children | surface sheet over content |
| `GlowBackground` | `variant` | radial SVG glows |
| `Lottie` | `name`, `loop` | confetti, equalizer, notes |
| `Icon` | 40+ stroke icons | 24 grid, 1.9 stroke |
| `Toggle`, `Badge`, `Avatar`, `SectionHeader`, `Waveform`, `Logo` | | |

## Accessibility
- Touch targets ≥ 44 px (`hitSlop` on small icons)
- Every icon-only button has `accessibilityLabel`
- Text contrast on glass ≥ 4.5:1 for body text (white / `#C9C3DA` on `#0A0A0F`)

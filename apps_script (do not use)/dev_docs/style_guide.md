Bulletin — Colors & Fonts (short)

Brand colors
------------
- **Primary (seed)**: `#9C8160` (AppTheme.primarySeed)
- **Secondary**: `#03DAC6` (AppTheme.secondarySeed)
- Usage: primary for primary actions, selected chips and badges; secondary for accents and success/positive states.

Typography
----------
- Body: 14–16sp, neutral weight (regular).
- Titles: medium/semibold for section headings.
- Captions: small, muted.
- Respect system font scaling.

Spacing & tokens
----------------
- Use the app spacing scale: 4 / 8 / 16 / 24 / 32.
- Row height target: ~72dp for list rows; tappable targets >= 48dp.

Quick rules
-----------
- Use `ColorScheme.fromSeed(seedColor: Color(0xFF9C8160), secondary: Color(0xFF03DAC6))` for theming.
- Keep surfaces neutral (light greys); use brand colors sparingly for emphasis.

Files to reference
------------------
- `front_end/lib/core/theme/app_theme.dart` — source of color seeds, spacing, and text-style extensions.

That's it — these values are the minimal tokens needed to match Bulletin's look-and-feel.


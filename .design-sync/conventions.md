# NutriCook AI — build conventions

No provider wrapper needed. Every component is self-contained — no theme
context, no root/router provider to mount. Import and render directly:

```jsx
import { Button, MealCard } from "nutricook-ai";

<Button label="Cook Now" primary onPress={() => {}} />
<MealCard meal={{ id: 1, type: "Dinner", name: "Salmon & Quinoa", kcal: 680,
  protein: 48, carbs: 52, fat: 22, time: "7:00 PM", prep: "30 min",
  difficulty: "Medium", done: false, emoji: "🐟", confidence: 98 }} />
```

## Styling idiom: inline styles from the `T` token object — no CSS classes

This system does not use utility classes, CSS modules, or a theme prop API.
Every component sets a plain React `style={{ ... }}` object built from
values on the exported `T` token object (`import { T } from "nutricook-ai"`).
There is no stylesheet to link — components carry their own inline styles at
render time. When composing new layout around these components, style it
the same way: inline `style` objects referencing `T`, never new hex values.

Real token names (see each component's `.d.ts`/source for exact usage):

- `T.mint`, `T.mintMid`, `T.mintDark`, `T.mintLight` — brand accent ramp
- `T.white`, `T.black`, `T.bg` — base surfaces
- `T.g1`…`T.g6` — neutral ramp, `g1` lightest to `g6` darkest
- `T.success`, `T.warn`, `T.error`, `T.blue` — status colors (also used for difficulty: Easy/Medium/Hard)
- `T.protein`, `T.carbs`, `T.fat`, `T.water` — macro-nutrient color coding, reused everywhere a macro is shown

Companion tokens, same import: `shadow.sm` / `shadow.md` (box-shadow strings),
`card` (a spread-ready `{background, borderRadius: 20, padding: 20, boxShadow}`
object used as the base for every elevated surface), `radius` (`pill: 999`,
`card: 20`, `control: 14`, `chip: 10`), and `fontFamily` (the system-font
stack — no webfont is shipped or expected).

## Where the truth lives

- `_ds_bundle.js` — the compiled components, real code, one IIFE on `window.NutriCookDS`.
- `components/<group>/<Name>/<Name>.d.ts` — the props contract per component.
- `components/<group>/<Name>/<Name>.prompt.md` — usage reference per component.

## One idiomatic build snippet

```jsx
import { Button, Ring, MacroRow, T, card } from "nutricook-ai";

function ProgressCard({ kcalLeft, protein, carbs, fat, targets }) {
  return (
    <div style={{ ...card, background: "linear-gradient(140deg, #0E2A1C 0%, #1A5C3A 60%, #1E8C5F 100%)" }}>
      <Ring pct={0.63} color={T.mint} size={120}>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.white }}>{kcalLeft}</div>
      </Ring>
      <MacroRow label="Protein" value={protein} target={targets.protein} color={T.protein} />
      <MacroRow label="Carbs" value={carbs} target={targets.carbs} color={T.carbs} />
      <MacroRow label="Fat" value={fat} target={targets.fat} color={T.fat} />
      <Button label="Generate New Plan" primary onPress={() => {}} />
    </div>
  );
}
```

## Frame

The product is a 430px-wide mobile app, not responsive web — design new
screens inside that frame width.

// Ingredient quantity parser — shared between AIScreen and tests.
// Extracted from NutriCookAI_v2.tsx so it can be imported directly
// in Node test files without needing JSX evaluation.

// ── Unit patterns ────────────────────────────────────────────────────────────
// Handles: oz, g, kg, lb/lbs, cups, tbsp, tsp, ml, l, piece, large/medium/small/whole,
//          can, bunch, handful, dozen, dash, pinch, splash, sprig, clove, slice
const UNIT_ALTS =
  "oz|g|kg|lb|lbs|cup|cups|tbsp|tsp|ml|l|litre|liter|" +
  "piece|pieces|large|medium|small|whole|slice|slices|" +
  "can|cans|bunch|bunches|handful|handfuls|dozen|" +
  "dash|dashes|pinch|pinches|splash|splashes|" +
  "sprig|sprigs|clove|cloves|serving|servings|head|heads|stalk|stalks";

// Prefix: "8 oz chicken", "1/2 cup oats", "3 large eggs", "1 dozen eggs"
const QTY_PATTERN = new RegExp(
  `^(?<qty>(?:\\d+\\s*\\/\\s*\\d+|\\d*\\.?\\d+)\\s*(?:${UNIT_ALTS})?)\\s+(?<name>.+)$`,
  "i"
);

// Suffix: "chicken 8oz", "salmon 200g"
const QTY_SUFFIX = new RegExp(
  `^(?<name>.+?)\\s*,?\\s*(?<qty>(?:\\d+\\s*\\/\\s*\\d+|\\d*\\.?\\d+)\\s*(?:${UNIT_ALTS}))$`,
  "i"
);

// "a handful of spinach", "a pinch of salt", "a dash of hot sauce"
const INDEFINITE_PREFIX = new RegExp(
  `^a(?:n)?\\s+(?<qty>${UNIT_ALTS})\\s+of\\s+(?<name>.+)$`,
  "i"
);

/**
 * Parse a free-form ingredient string into { qty, name }.
 *
 * Examples:
 *   "8 oz chicken breast"     → { qty: "8 oz",      name: "chicken breast" }
 *   "200g salmon"             → { qty: "200g",       name: "salmon" }
 *   "1/2 cup oats"            → { qty: "1/2 cup",   name: "oats" }
 *   "3 large eggs"            → { qty: "3 large",   name: "eggs" }
 *   "1 dozen eggs"            → { qty: "1 dozen",   name: "eggs" }
 *   "a handful of spinach"    → { qty: "handful",   name: "spinach" }
 *   "a pinch of salt"         → { qty: "pinch",     name: "salt" }
 *   "chicken"                 → { qty: "",           name: "chicken" }
 */
export function parseIngredientInput(raw) {
  const trimmed = raw.trim();

  // "a handful of spinach" / "a pinch of salt"
  const indefiniteMatch = trimmed.match(INDEFINITE_PREFIX);
  if (indefiniteMatch) {
    return {
      qty:  indefiniteMatch.groups.qty.trim(),
      name: indefiniteMatch.groups.name.trim().toLowerCase(),
    };
  }

  // "8 oz chicken breast" / "1 dozen eggs" (prefix)
  const prefixMatch = trimmed.match(QTY_PATTERN);
  if (prefixMatch) {
    const qty  = prefixMatch.groups.qty.trim();
    const name = prefixMatch.groups.name.trim().toLowerCase();
    if (qty && /\d/.test(qty)) return { qty, name };
  }

  // "chicken 8oz" (suffix)
  const suffixMatch = trimmed.match(QTY_SUFFIX);
  if (suffixMatch) {
    const qty  = suffixMatch.groups.qty.trim();
    const name = suffixMatch.groups.name.trim().toLowerCase();
    if (qty && /\d/.test(qty)) return { qty, name };
  }

  return { qty: "", name: trimmed.toLowerCase() };
}

/** Format a { qty, name } ingredient as a display/prompt string. */
export function ingLabel({ qty, name }) {
  return qty ? `${qty} ${name}` : name;
}

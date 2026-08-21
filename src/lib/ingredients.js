// Ingredient quantity parser — shared between AIScreen and tests.
// Extracted from NutriCookAI_v2.tsx so it can be imported directly
// in Node test files without needing JSX evaluation.

const QTY_PATTERN =
  /^(?<qty>(?:\d+\s*\/\s*\d+|\d*\.?\d+)\s*(?:oz|g|kg|lb|lbs|cup|cups|tbsp|tsp|ml|l|litre|liter|piece|pieces|large|medium|small|whole|slice|slices|can|cans|bunch|bunches|handful|handfuls|serving|servings)?)\s+(?<name>.+)$/i;
const QTY_SUFFIX =
  /^(?<name>.+?)\s*,?\s*(?<qty>(?:\d+\s*\/\s*\d+|\d*\.?\d+)\s*(?:oz|g|kg|lb|lbs|cup|cups|tbsp|tsp|ml|l|litre|liter|piece|pieces|large|medium|small|whole|slice|slices|can|cans|bunch|bunches|handful|handfuls|serving|servings))$/i;

/**
 * Parse a free-form ingredient string into { qty, name }.
 * Examples:
 *   "8 oz chicken breast" → { qty: "8 oz", name: "chicken breast" }
 *   "200g salmon"         → { qty: "200g",  name: "salmon" }
 *   "1/2 cup oats"        → { qty: "1/2 cup", name: "oats" }
 *   "3 large eggs"        → { qty: "3 large",  name: "eggs" }
 *   "chicken"             → { qty: "",  name: "chicken" }
 */
export function parseIngredientInput(raw) {
  const trimmed = raw.trim();
  const prefixMatch = trimmed.match(QTY_PATTERN);
  if (prefixMatch) {
    const qty  = prefixMatch.groups.qty.trim();
    const name = prefixMatch.groups.name.trim().toLowerCase();
    if (qty && /\d/.test(qty)) return { qty, name };
  }
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

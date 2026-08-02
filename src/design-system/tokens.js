// NutriCook AI design tokens — mirrors the frozen `const T` in src/App.jsx.
// This is the single source of truth for design-system components; do not
// fork new hex values, extend this file instead.
export const T = {
  mint: "#A8F5D3", mintMid: "#3EC98A", mintDark: "#1A8C5F", mintLight: "#F0FBF6",
  bg: "#F5F5F7", white: "#FFFFFF", black: "#1C1C1E",
  g1: "#F5F5F7", g2: "#E5E5EA", g3: "#C7C7CC", g4: "#8E8E93", g5: "#636366", g6: "#3A3A3C",
  success: "#34C759", warn: "#FF9500", error: "#FF3B30", blue: "#007AFF",
  protein: "#3EC98A", carbs: "#FFB340", fat: "#FF6B6B", water: "#5AC8FA",
};

export const shadow = {
  sm: "0 1px 6px rgba(0,0,0,0.06)",
  md: "0 2px 16px rgba(0,0,0,0.08)",
};

export const card = {
  background: T.white,
  borderRadius: 20,
  padding: "20px",
  boxShadow: shadow.md,
};

export const radius = { pill: 999, card: 20, control: 14, chip: 10 };

export const fontFamily = "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif";

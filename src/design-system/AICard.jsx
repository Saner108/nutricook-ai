import { useState } from "react";
import { T, card } from "./tokens.js";
import Button from "./Button.jsx";
import MacroBar from "./MacroBar.jsx";

/**
 * @typedef {{
 *   name: string, difficulty: "Easy"|"Medium"|"Hard", prepTime: string,
 *   servings: number,
 *   macros: { calories: number, protein: number, carbs: number, fat: number },
 *   steps: string[],
 * }} Recipe
 * @param {{ recipe: Recipe, index: number }} props
 */
export default function AICard({ recipe, index }) {
  const [open, setOpen] = useState(false);
  const diffColor = { Easy: T.success, Medium: T.warn, Hard: T.error }[recipe.difficulty] || T.success;
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 14, animation: `fadeUp 0.4s ease ${index * 0.12}s both` }}>
      <div style={{ background: "linear-gradient(135deg, #1A3A2A 0%, #1A8C5F 100%)", padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.mint, letterSpacing: 1 }}>OPTION {index + 1}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: diffColor, color: "#1B4332" }}>{recipe.difficulty}</span>
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.white, lineHeight: 1.2, marginBottom: 8 }}>{recipe.name}</div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
          <span>⏱ {recipe.prepTime}</span>
          <span>👤 {recipe.servings} servings</span>
          <span style={{ color: T.mint, fontWeight: 700 }}>{recipe.macros.calories} kcal</span>
        </div>
      </div>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.g2}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: T.mintDark, marginBottom: 10 }}>Nutrition per serving</div>
        <MacroBar label="Protein" value={recipe.macros.protein} max={80} color={T.protein} />
        <MacroBar label="Carbohydrates" value={recipe.macros.carbs} max={120} color={T.carbs} />
        <MacroBar label="Fat" value={recipe.macros.fat} max={60} color={T.fat} />
      </div>
      <div style={{ padding: "12px 18px" }}>
        <button onClick={() => setOpen(!open)} style={{
          width: "100%", background: open ? T.mintLight : T.g1, border: `1.5px solid ${open ? T.mint : T.g2}`,
          borderRadius: 12, padding: "10px 14px", cursor: "pointer", display: "flex",
          justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 700, color: T.mintDark,
        }}>
          <span>{open ? "Hide" : "Show"} Steps ({recipe.steps.length})</span>
          <span style={{ fontSize: 10, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
        </button>
        {open && (
          <ol style={{ margin: "12px 0 0", padding: 0 }}>
            {recipe.steps.map((s, i) => (
              <li key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, background: T.mintDark, color: T.white, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: T.g6, lineHeight: 1.6 }}>{s}</span>
              </li>
            ))}
          </ol>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button label="Cook Now" primary onPress={() => {}} style={{ flex: 1 }} />
          <Button label="Save" onPress={() => {}} style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  );
}

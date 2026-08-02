import { useState } from "react";
import { T, card } from "./tokens.js";
import Button from "./Button.jsx";

/**
 * @typedef {{
 *   id: number, type: string, name: string, kcal: number,
 *   protein: number, carbs: number, fat: number, time: string,
 *   prep: string, difficulty: "Easy"|"Medium"|"Hard", done: boolean,
 *   emoji: string, confidence: number,
 * }} Meal
 * @param {{ meal: Meal }} props
 */
export default function MealCard({ meal }) {
  const [open, setOpen] = useState(false);
  const diffColor = { Easy: T.success, Medium: T.warn, Hard: T.error }[meal.difficulty];
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ height: 4, background: meal.done ? T.mintDark : T.g2 }} />
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: meal.done ? T.mintLight : T.g1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>{meal.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.g4, textTransform: "uppercase", letterSpacing: 0.8 }}>{meal.type}</span>
              <span style={{ fontSize: 11, color: meal.done ? T.mintDark : T.g4, fontWeight: 600 }}>{meal.done ? "✓ Done" : meal.time}</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.black, marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meal.name}</div>
            <div style={{ display: "flex", gap: 10, fontSize: 12, color: T.g4 }}>
              <span style={{ fontWeight: 700, color: T.black }}>{meal.kcal} kcal</span>
              <span>· {meal.prep}</span>
              <span style={{ color: diffColor, fontWeight: 600 }}>· {meal.difficulty}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[["P", meal.protein, T.protein], ["C", meal.carbs, T.carbs], ["F", meal.fat, T.fat], ["AI", `${meal.confidence}%`, T.mintDark]].map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, background: T.g1, borderRadius: 10, padding: "8px 0", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}{l !== "AI" ? "g" : ""}</div>
              <div style={{ fontSize: 10, color: T.g4, fontWeight: 500 }}>{l === "P" ? "Protein" : l === "C" ? "Carbs" : l === "F" ? "Fat" : "AI Score"}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Button label="View Recipe" small onPress={() => setOpen(!open)} style={{ flex: 1 }} />
          <Button label="Swap" small onPress={() => {}} style={{ flex: 1 }} />
          <button style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: T.g1, cursor: "pointer", fontSize: 16 }}>♡</button>
        </div>
        {open && (
          <div style={{ marginTop: 12, padding: "12px", background: T.mintLight, borderRadius: 12, fontSize: 13, color: T.g6, lineHeight: 1.7 }}>
            <strong>Quick steps:</strong> Heat pan over medium heat. Prepare your {meal.name.toLowerCase()} ingredients. Cook for the recommended time, season to taste, and serve fresh. For detailed nutrition info, use the AI Generator tab.
          </div>
        )}
      </div>
    </div>
  );
}

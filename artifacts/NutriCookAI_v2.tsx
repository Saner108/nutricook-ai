import { useState, useEffect, useRef } from "react";

// ── Tokens ──────────────────────────────────────────────
const T = {
  mint: "#A8F5D3", mintMid: "#3EC98A", mintDark: "#1A8C5F", mintLight: "#F0FBF6",
  bg: "#F5F5F7", white: "#FFFFFF", black: "#1C1C1E",
  g1: "#F5F5F7", g2: "#E5E5EA", g3: "#C7C7CC", g4: "#8E8E93", g5: "#636366", g6: "#3A3A3C",
  success: "#34C759", warn: "#FF9500", error: "#FF3B30", blue: "#007AFF",
  protein: "#3EC98A", carbs: "#FFB340", fat: "#FF6B6B", water: "#5AC8FA",
};
const shadow = { sm: "0 1px 6px rgba(0,0,0,0.06)", md: "0 2px 16px rgba(0,0,0,0.08)", lg: "0 8px 32px rgba(0,0,0,0.12)" };
const card = { background: T.white, borderRadius: 20, padding: "20px", boxShadow: shadow.md };

// ── Static Data ──────────────────────────────────────────
const USER = { name: "Cesar", goal: "Muscle Gain", weightLbs: 175, targetLbs: 185, streak: 12 };
const TARGETS = { kcal: 2200, protein: 165, carbs: 220, fat: 73, water: 8 };
const CONSUMED = { kcal: 1380, protein: 98, carbs: 145, fat: 48, water: 5 };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NOW = new Date();
const TODAY = (NOW.getDay() + 6) % 7; // Monday-first index of today
const WEEK_DATES = DAYS.map((_, i) => { const d = new Date(NOW); d.setDate(NOW.getDate() - TODAY + i); return d.getDate(); });

const MEALS = [
  { id:1, type:"Breakfast", name:"Egg & Avocado Toast", kcal:520, protein:28, carbs:42, fat:18, time:"8:30 AM", prep:"10 min", difficulty:"Easy", done:true, emoji:"🍳", confidence:96 },
  { id:2, type:"Lunch", name:"Grilled Chicken Bowl", kcal:680, protein:52, carbs:68, fat:18, time:"12:30 PM", prep:"20 min", difficulty:"Easy", done:true, emoji:"🥗", confidence:94 },
  { id:3, type:"Snack", name:"Greek Yogurt & Berries", kcal:180, protein:18, carbs:22, fat:4, time:"3:30 PM", prep:"2 min", difficulty:"Easy", done:true, emoji:"🫐", confidence:92 },
  { id:4, type:"Dinner", name:"Salmon & Quinoa", kcal:680, protein:48, carbs:52, fat:22, time:"7:00 PM", prep:"30 min", difficulty:"Medium", done:false, emoji:"🐟", confidence:98 },
];


// Deterministic meal history — same past day always shows the same meals.
const MEAL_POOL = [
  { name:"Veggie Omelette & Sourdough", emoji:"🍳", kcal:440, protein:27, carbs:36, fat:20, prep:"12 min", difficulty:"Easy" },
  { name:"Turkey & Sweet Potato Skillet", emoji:"🥔", kcal:610, protein:44, carbs:54, fat:22, prep:"25 min", difficulty:"Medium" },
  { name:"Overnight Oats & Berries", emoji:"🍚", kcal:390, protein:22, carbs:58, fat:9, prep:"5 min", difficulty:"Easy" },
  { name:"Beef & Broccoli Rice Bowl", emoji:"🥣", kcal:650, protein:46, carbs:62, fat:21, prep:"30 min", difficulty:"Medium" },
  { name:"Cottage Cheese & Pineapple", emoji:"🍍", kcal:210, protein:24, carbs:20, fat:4, prep:"2 min", difficulty:"Easy" },
  { name:"Lemon Herb Cod & Couscous", emoji:"🐟", kcal:540, protein:42, carbs:48, fat:16, prep:"25 min", difficulty:"Medium" },
  { name:"Peanut Butter Banana Toast", emoji:"🍌", kcal:340, protein:14, carbs:44, fat:14, prep:"5 min", difficulty:"Easy" },
  { name:"Chicken Fajita Wraps", emoji:"🌮", kcal:590, protein:41, carbs:56, fat:19, prep:"20 min", difficulty:"Easy" },
  { name:"Tofu Veggie Stir-Fry", emoji:"🥘", kcal:480, protein:28, carbs:46, fat:20, prep:"18 min", difficulty:"Easy" },
  { name:"Protein Smoothie Bowl", emoji:"🥤", kcal:320, protein:30, carbs:38, fat:7, prep:"5 min", difficulty:"Easy" },
];
function historyFor(offsetDays) {
  const slots = ["Breakfast", "Lunch", "Dinner", "Snack"];
  const out = {};
  slots.forEach((slot, slotIndex) => {
    const idx = Math.abs(offsetDays * 7 + slotIndex * 3) % MEAL_POOL.length;
    out[slot] = { ...MEAL_POOL[idx], id: `h${offsetDays}-${slotIndex}`, type: slot, done: true, time: "", confidence: 90 + (idx % 9) };
  });
  return out;
}

const GROCERY = {
  "Proteins": [{ id:1, name:"Chicken Breast", qty:"2 lbs", done:true }, { id:2, name:"Salmon Fillet", qty:"12 oz", done:false }, { id:3, name:"Greek Yogurt", qty:"32 oz", done:true }, { id:4, name:"Eggs", qty:"12 count", done:false }],
  "Vegetables": [{ id:5, name:"Broccoli", qty:"1 head", done:true }, { id:6, name:"Baby Spinach", qty:"5 oz", done:false }, { id:7, name:"Bell Peppers", qty:"3 mixed", done:false }],
  "Grains": [{ id:8, name:"Quinoa", qty:"1 lb bag", done:false }, { id:9, name:"Brown Rice", qty:"2 lbs", done:true }],
  "Fruits": [{ id:10, name:"Mixed Berries", qty:"12 oz frozen", done:false }, { id:11, name:"Avocado", qty:"2 ripe", done:false }, { id:12, name:"Banana", qty:"1 bunch", done:true }],
  "Dairy": [{ id:13, name:"Cottage Cheese", qty:"16 oz", done:false }, { id:14, name:"Almond Milk", qty:"½ gallon", done:false }],
};

const INGREDIENT_DB = [
  "chicken", "chicken breast", "chicken thighs", "ground beef", "ground turkey", "steak", "salmon", "tuna", "shrimp", "cod", "tilapia", "pork chops", "bacon", "ham", "turkey", "tofu", "tempeh", "eggs", "egg whites",
  "greek yogurt", "cottage cheese", "cheddar cheese", "mozzarella", "parmesan", "feta", "milk", "almond milk", "oat milk", "butter", "cream cheese", "sour cream",
  "broccoli", "spinach", "kale", "bell peppers", "onion", "red onion", "garlic", "tomatoes", "cherry tomatoes", "carrots", "celery", "zucchini", "mushrooms", "asparagus", "green beans", "cauliflower", "sweet potato", "potatoes", "corn", "peas", "cucumber", "lettuce", "cabbage", "brussels sprouts", "eggplant", "avocado", "jalapeño", "ginger", "cilantro", "basil", "parsley", "green onions",
  "rice", "brown rice", "jasmine rice", "quinoa", "oats", "pasta", "whole wheat pasta", "bread", "whole wheat bread", "tortillas", "couscous", "black beans", "chickpeas", "lentils", "kidney beans", "pinto beans",
  "banana", "apple", "berries", "strawberries", "blueberries", "raspberries", "lemon", "lime", "orange", "mango", "pineapple", "grapes", "peach", "watermelon",
  "olive oil", "coconut oil", "soy sauce", "honey", "maple syrup", "peanut butter", "almond butter", "almonds", "walnuts", "cashews", "peanuts", "chia seeds", "flax seeds", "hummus", "salsa", "coconut milk", "chicken broth", "tomato sauce", "protein powder", "dark chocolate",
];

const DIETARY_OPTS = ["Vegan","Vegetarian","Gluten-Free","Dairy-Free","Keto","Low-Carb","High-Protein","Nut-Free"];
const GOAL_OPTS = ["Fat Loss","Muscle Gain","Maintenance","High Protein","Low Carb","Balanced"];

const ACHIEVEMENTS = [
  { emoji:"🔥", label:"12-Day Streak" }, { emoji:"💪", label:"Protein Goal x7" },
  { emoji:"🥗", label:"Meal Planner" }, { emoji:"💧", label:"Hydration Pro" },
];

const WEIGHT_SEED = [
  { d: "Jun 12", w: 172.4 }, { d: "Jun 19", w: 173.1 }, { d: "Jun 26", w: 173.0 },
  { d: "Jul 3", w: 173.8 }, { d: "Jul 10", w: 174.4 }, { d: "Jul 17", w: 175.0 },
];

const FUN_FACTS = [
  "Protein has the highest thermic effect of any macro — your body burns roughly 25% of protein calories just digesting it.",
  "Eating slowly gives your brain the ~20 minutes it needs to register fullness, which naturally reduces how much you eat.",
  "Gram for gram, broccoli has more vitamin C than oranges.",
  "Muscle tissue burns about 3x more calories at rest than fat tissue — strength training raises your baseline burn.",
  "Losing just 2% of your body water can measurably reduce strength, endurance, and focus.",
  "Eggs contain every essential amino acid — one of the few true complete proteins in a whole food.",
  "People who meal-prep at least twice a week consistently show better diet quality and lower food spending.",
];

// ── Small Components ─────────────────────────────────────
function Ring({ pct, color, size = 110, stroke = 10, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - Math.min(pct, 1))), 150);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.g1} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,.68,0,1.2)" }}
        />
      </svg>
      <div style={{ textAlign: "center" }}>{children}</div>
    </div>
  );
}

function MiniRing({ pct, color, size = 60, stroke = 6, label, value, unit }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - Math.min(pct, 1))), 300);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={size} height={size} style={{ position: "absolute" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.g1} strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,.68,0,1.2) 0.2s" }}
          />
        </svg>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.black }}>{value}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: color }}>{label}</div>
        <div style={{ fontSize: 10, color: T.g4 }}>{unit}</div>
      </div>
    </div>
  );
}

function MacroBar({ label, value, max, color }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.min((value / max) * 100, 100)), 200);
    return () => clearTimeout(t);
  }, [value, max]);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: T.g4, fontWeight: 500 }}>{label}</span>
        <span style={{ color: T.black, fontWeight: 700 }}>{value}g</span>
      </div>
      <div style={{ height: 6, background: T.g2, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 99, transition: "width 1s cubic-bezier(.22,.68,0,1.2)" }} />
      </div>
    </div>
  );
}

function Pill({ text, color, bg, size = 12 }) {
  return <span style={{ background: bg || T.g1, color: color || T.g5, fontSize: size, fontWeight: 600, padding: "3px 10px", borderRadius: 99 }}>{text}</span>;
}

function Btn({ label, onPress, primary, small, style: st }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button onClick={onPress}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      style={{
        padding: small ? "8px 16px" : "14px 24px", borderRadius: 14, border: "none",
        background: primary ? T.mintDark : T.g1, color: primary ? T.white : T.g6,
        fontSize: small ? 13 : 15, fontWeight: 700, cursor: "pointer",
        transform: pressed ? "scale(0.97)" : "scale(1)", transition: "transform 0.1s, background 0.15s",
        letterSpacing: 0.2, ...st
      }}>{label}
    </button>
  );
}

// ── Meal Card ────────────────────────────────────────────
function MealCard({ meal, compact, isFav, onFav }) {
  const [open, setOpen] = useState(false);
  const [localFav, setLocalFav] = useState(false);
  const fav = onFav ? !!isFav : localFav; // controlled when wired to app-level favorites
  const diffColor = { Easy: T.success, Medium: T.warn, Hard: T.error }[meal.difficulty];
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 12 }}>
      {/* Color bar by type */}
      <div style={{ height: 4, background: meal.done ? T.mintDark : T.g2 }} />
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {/* Emoji thumbnail */}
          <div style={{ width: 56, height: 56, borderRadius: 14, background: meal.done ? T.mintLight : T.g1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, flexShrink: 0 }}>
            {meal.emoji}
          </div>
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

        {/* Macro row */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[["P", meal.protein, T.protein], ["C", meal.carbs, T.carbs], ["F", meal.fat, T.fat]].map(([l, v, c]) => (
            <div key={l} style={{ flex: 1, background: T.g1, borderRadius: 10, padding: "8px 0", textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}g</div>
              <div style={{ fontSize: 10, color: T.g4, fontWeight: 500 }}>{l === "P" ? "Protein" : l === "C" ? "Carbs" : "Fat"}</div>
            </div>
          ))}
          <div style={{ flex: 1, background: T.g1, borderRadius: 10, padding: "8px 0", textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.mintDark }}>{meal.confidence}%</div>
            <div style={{ fontSize: 10, color: T.g4, fontWeight: 500 }}>AI Score</div>
          </div>
        </div>

        {/* Actions */}
        {!compact && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <Btn label="View Recipe" small onPress={() => setOpen(!open)} style={{ flex: 1 }} />
            <Btn label="Swap" small onPress={() => {}} style={{ flex: 1 }} />
            <button onClick={() => (onFav ? onFav(meal) : setLocalFav(f => !f))} style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: fav ? T.mintLight : T.g1, cursor: "pointer", fontSize: 16, color: fav ? T.error : T.g5, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}>{fav ? "♥" : "♡"}</button>
          </div>
        )}
        {open && (
          <div style={{ marginTop: 12, padding: "12px", background: T.mintLight, borderRadius: 12, fontSize: 13, color: T.g6, lineHeight: 1.7, animation: "popIn .25s ease both" }}>
            <strong>Steps:</strong> Heat pan over medium heat. Add oil and cook ingredients for 5–7 minutes. Season to taste. Plate and serve immediately. Enjoy your {meal.name}!
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI Recipe Result Card ─────────────────────────────────
function AICard({ recipe, index, onSave, onReplace }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [remixing, setRemixing] = useState(false);
  const [swapMode, setSwapMode] = useState(false);
  const [swapVal, setSwapVal] = useState("");
  const [remixErr, setRemixErr] = useState(null);

  const remix = async instruction => {
    if (remixing) return;
    setRemixing(true); setRemixErr(null); setSwapMode(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 1200,
          messages: [{ role: "user", content: `Remix this recipe: ${JSON.stringify(recipe)}. Instruction: ${instruction}. Keep it realistic and adjust macros accordingly. Respond ONLY with valid JSON of the exact same schema (single recipe object, no wrapper): {"name":"","difficulty":"Easy","prepTime":"","servings":2,"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"ingredients":[""],"steps":[""]}` }],
        }),
      });
      if (!res.ok) throw new Error("remix failed");
      const data = await res.json();
      const text = (data.content || []).map(b => b.text || "").join("");
      const next = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (!next || !next.name || !next.macros) throw new Error("bad remix");
      if (onReplace) onReplace(index, next);
      setSaved(false);
    } catch {
      setRemixErr("Remix didn't come out right — try again.");
    } finally {
      setRemixing(false);
    }
  };
  const diffColor = { Easy: T.success, Medium: T.warn, Hard: T.error }[recipe.difficulty] || T.success;
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 14, animation: `fadeUp 0.4s ease ${index * 0.12}s both` }}>
      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, #1A3A2A 0%, #1A8C5F 100%)`, padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <Pill text={`Option ${index + 1}`} color={T.mint} bg="rgba(168,245,211,0.2)" />
          <Pill text={recipe.difficulty} color="#1A3A2A" bg={diffColor} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.white, lineHeight: 1.2, marginBottom: 8 }}>{recipe.name}</div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
          <span>⏱ {recipe.prepTime}</span>
          <span>👤 {recipe.servings} servings</span>
          <span style={{ color: T.mint, fontWeight: 700 }}>{recipe.macros.calories} kcal</span>
        </div>
      </div>
      {/* Macros */}
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.g2}` }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: T.mintDark, marginBottom: 10 }}>Nutrition per serving</div>
        <MacroBar label="Protein" value={recipe.macros.protein} max={80} color={T.protein} />
        <MacroBar label="Carbohydrates" value={recipe.macros.carbs} max={120} color={T.carbs} />
        <MacroBar label="Fat" value={recipe.macros.fat} max={60} color={T.fat} />
      </div>
      {/* Steps */}
      <div style={{ padding: "12px 18px" }}>
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {recipe.ingredients.map(ing => <span key={ing} style={{ background: T.g1, borderRadius: 99, padding: "4px 10px", fontSize: 12, color: T.g5, fontWeight: 500 }}>{ing}</span>)}
          </div>
        )}
        <button onClick={() => setOpen(!open)} style={{
          width: "100%", background: open ? T.mintLight : T.g1, border: `1.5px solid ${open ? T.mint : T.g2}`,
          borderRadius: 12, padding: "10px 14px", cursor: "pointer", display: "flex",
          justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 700, color: T.mintDark,
        }}>
          <span>{open ? "Hide" : "Show"} Steps ({recipe.steps.length})</span>
          <span style={{ fontSize: 10, transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
        </button>
        {open && (
          <ol style={{ margin: "12px 0 0", padding: 0, animation: "popIn .25s ease both" }}>
            {recipe.steps.map((s, i) => (
              <li key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, background: T.mintDark, color: T.white, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i+1}</span>
                <span style={{ fontSize: 13, color: T.g6, lineHeight: 1.6 }}>{s}</span>
              </li>
            ))}
          </ol>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn label="Cook Now" primary onPress={() => setOpen(true)} style={{ flex: 1 }} />
          <Btn label={saved ? "✓ Saved" : "Save"} onPress={() => { if (!saved && onSave) onSave(recipe); setSaved(s => !s); }} style={{ flex: 1, color: saved ? T.mintDark : undefined, background: saved ? T.mintLight : undefined }} />
        </div>
        {saved && recipe.ingredients && recipe.ingredients.length > 0 && (
          <div style={{ fontSize: 11, color: T.mintDark, fontWeight: 600, marginTop: 8, textAlign: "center" }}>Saved to Want-to-Try · 🛒 ingredients added to Grocery</div>
        )}
        {/* AI Remix agent */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.g1}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.g4, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
            {remixing ? "🌀 Remixing this recipe…" : "✨ Remix with AI"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, opacity: remixing ? 0.5 : 1 }}>
            {[["🌶 Spicier", "Make it noticeably spicier"], ["💪 More protein", "Increase the protein significantly"], ["🔥 Fewer calories", "Reduce the calories while keeping it satisfying"], ["x2 Servings", "Double the servings and scale ingredients"]].map(([label, instruction]) => (
              <button key={label} onClick={() => remix(instruction)} disabled={remixing} style={{
                padding: "6px 12px", borderRadius: 99, border: `1.5px solid ${T.g2}`, background: T.white,
                color: T.g5, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}>{label}</button>
            ))}
            <button onClick={() => setSwapMode(s => !s)} disabled={remixing} style={{
              padding: "6px 12px", borderRadius: 99, border: `1.5px solid ${swapMode ? T.mintDark : T.g2}`, background: swapMode ? T.mintLight : T.white,
              color: swapMode ? T.mintDark : T.g5, fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>🔄 Swap ingredient</button>
          </div>
          {swapMode && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={swapVal} onChange={e => setSwapVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && swapVal.trim() && remix(`Swap out: ${swapVal.trim()}. Replace it with something that fits the recipe`)}
                placeholder="What should we swap out? e.g. broccoli"
                style={{ flex: 1, border: `1.5px solid ${T.g2}`, borderRadius: 10, padding: "8px 12px", fontSize: 13, outline: "none", background: T.g1, color: T.black }} />
              <Btn small label="Swap" primary onPress={() => swapVal.trim() && remix(`Swap out: ${swapVal.trim()}. Replace it with something that fits the recipe`)} />
            </div>
          )}
          {remixErr && <div style={{ fontSize: 12, color: T.error, marginTop: 8 }}>⚠️ {remixErr}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Streaming helpers (pure; unit-tested in test/) ───────
function extractRecipes(text) {
  const start = text.indexOf("[");
  const complete = [];
  let partialName = null;
  if (start === -1) return { complete, partialName };
  let depth = 0, inStr = false, esc = false, objStart = -1;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { if (inStr) esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") { if (depth === 0) objStart = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0 && objStart !== -1) { try { complete.push(JSON.parse(text.slice(objStart, i + 1))); } catch {} objStart = -1; } }
    else if (ch === "]" && depth === 0) break;
  }
  if (objStart !== -1) {
    const frag = text.slice(objStart);
    const m = frag.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m) { try { partialName = JSON.parse('"' + m[1] + '"'); } catch { partialName = m[1]; } }
  }
  return { complete, partialName };
}

async function readSSEText(reader, onText) {
  const decoder = new TextDecoder();
  let buf = "", acc = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      let evt;
      try { evt = JSON.parse(t.slice(5).trim()); } catch { continue; }
      if (evt.type === "message_stop") return acc;
      const d = evt.delta;
      if (evt.type === "content_block_delta" && d && d.type === "text_delta" && typeof d.text === "string") {
        acc += d.text;
        if (onText) onText(acc);
      }
    }
  }
  return acc;
}

async function streamRecipes(apiKey, prompt, onUpdate, fetchFn) {
  const doFetch = fetchFn || ((u, o) => fetch(u, o));
  const res = await doFetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, stream: true, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error("Recipe service error");
  const reader = res.body.getReader();
  let full = await readSSEText(reader, text => {
    if (onUpdate) onUpdate(extractRecipes(text));
  });
  full = full.replace(/```json|```/g, "").trim();
  let recipes = null;
  try { recipes = JSON.parse(full).recipes; } catch {}
  if (!recipes || !recipes.length) recipes = extractRecipes(full).complete;
  if (!recipes.length) throw new Error("No recipes in response");
  return recipes;
}

// ── Screens ──────────────────────────────────────────────

function HomeScreen({ setTab, favorites, toggleFavorite }) {
  const [water, setWater] = useState(CONSUMED.water);
  const rem = TARGETS.kcal - CONSUMED.kcal;
  const prot = CONSUMED.protein / TARGETS.protein;
  const carbs = CONSUMED.carbs / TARGETS.carbs;
  const fat = CONSUMED.fat / TARGETS.fat;

  return (
    <div style={{ padding: "16px 16px 8px" }}>
      {/* Greeting */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, color: T.g4, fontWeight: 500 }}>{NOW.getHours() < 12 ? "Good morning," : NOW.getHours() < 18 ? "Good afternoon," : "Good evening,"}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.black, letterSpacing: -0.5 }}>{USER.name} 👋</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 99, background: `linear-gradient(135deg, ${T.mintDark}, ${T.mint})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💪</div>
      </div>

      {/* Progress Card */}
      <div style={{ ...card, background: `linear-gradient(140deg, #0E2A1C 0%, #1A5C3A 60%, #1E8C5F 100%)`, marginBottom: 14, padding: "22px 20px", animation: "slideUp .4s cubic-bezier(.22,.68,0,1) both" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.55)", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Today's Progress</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Ring pct={CONSUMED.kcal / TARGETS.kcal} color={T.mint} size={120} stroke={10}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.white, lineHeight: 1 }}>{rem}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>kcal left</div>
          </Ring>
          <div style={{ flex: 1, paddingLeft: 24 }}>
            <MacroRow label="Protein" value={CONSUMED.protein} target={TARGETS.protein} color={T.protein} />
            <MacroRow label="Carbs" value={CONSUMED.carbs} target={TARGETS.carbs} color={T.carbs} />
            <MacroRow label="Fat" value={CONSUMED.fat} target={TARGETS.fat} color={T.fat} />
          </div>
        </div>
        {/* Water */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>💧 Water</span>
            <span style={{ fontSize: 12, color: T.mint, fontWeight: 700 }}>{water}/{TARGETS.water} glasses</span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {Array(TARGETS.water).fill(0).map((_, i) => (
              <div key={i} onClick={() => setWater(i + 1 === water ? i : i + 1)} title="Tap to log water"
                style={{ flex: 1, height: 8, borderRadius: 99, cursor: "pointer", background: i < water ? T.water : "rgba(255,255,255,0.15)", transition: "background 0.2s" }} />
            ))}
          </div>
        </div>
      </div>

      {/* AI Banner */}
      <div style={{ ...card, background: T.mintLight, border: `1.5px solid ${T.mint}`, marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px", animation: "slideUp .4s cubic-bezier(.22,.68,0,1) both", animationDelay: "0.06s" }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>🌿</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.mintDark, marginBottom: 4 }}>AI Meal Planner</div>
          <div style={{ fontSize: 13, color: T.g5, lineHeight: 1.5, marginBottom: 12 }}>Based on your goals and available ingredients, we've created today's meal plan.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn label="Generate New Plan" primary small onPress={() => setTab("ai")} style={{ fontSize: 12 }} />
            <Btn label="Customize" small onPress={() => setTab("ai")} style={{ fontSize: 12 }} />
          </div>
        </div>
      </div>

      {/* Today's Meals */}
      <div style={{ fontSize: 18, fontWeight: 700, color: T.black, marginBottom: 12 }}>Today's Meals</div>
      {MEALS.map((m, i) => (
        <div key={m.id} style={{ animation: "slideUp .4s cubic-bezier(.22,.68,0,1) both", animationDelay: `${(i + 2) * 0.06}s` }}>
          <MealCard meal={m} isFav={favorites.some(f => f.name === m.name)} onFav={toggleFavorite} />
        </div>
      ))}
    </div>
  );
}

function MacroRow({ label, value, target, color }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.min((value / target) * 100, 100)), 250);
    return () => clearTimeout(t);
  }, [value, target]);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{label}</span>
        <span style={{ color: T.white, fontWeight: 700 }}>{value}<span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>/{target}g</span></span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.15)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 99, transition: "width 1s cubic-bezier(.22,.68,0,1.2)" }} />
      </div>
    </div>
  );
}

function PlanScreen({ setTab, favorites, toggleFavorite }) {
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week … -3 = 3 weeks ago
  const [day, setDay] = useState(TODAY);
  const [expanded, setExpanded] = useState("Dinner");
  const types = ["Breakfast","Lunch","Dinner","Snack"];
  const weekDates = DAYS.map((_, i) => { const d = new Date(NOW); d.setDate(NOW.getDate() - TODAY + i + weekOffset * 7); return d; });
  const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const weekLabel = ["This Week", "Last Week", "2 Weeks Ago", "3 Weeks Ago"][-weekOffset];
  const offsetDays = weekOffset * 7 + (day - TODAY);
  const isToday = weekOffset === 0 && day === TODAY;
  const isPast = offsetDays < 0;
  const history = isPast ? historyFor(offsetDays) : null;
  const histTotals = history ? types.reduce((a, t) => ({ kcal: a.kcal + history[t].kcal, protein: a.protein + history[t].protein, carbs: a.carbs + history[t].carbs, fat: a.fat + history[t].fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }) : null;
  const pagerBtn = enabled => ({
    width: 32, height: 32, borderRadius: 99, border: "none", background: T.white, boxShadow: shadow.sm,
    cursor: enabled ? "pointer" : "default", fontSize: 16, fontWeight: 700, color: T.g6,
    opacity: enabled ? 1 : 0.35, transition: "all .18s cubic-bezier(.34,1.56,.64,1)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  });
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.black, marginBottom: 12, letterSpacing: -0.3 }}>Weekly Plan</div>
      {/* Week pager */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={() => weekOffset > -3 && setWeekOffset(o => o - 1)} style={pagerBtn(weekOffset > -3)}>‹</button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.black }}>{weekLabel}</div>
          <div style={{ fontSize: 11, color: T.g4, marginTop: 1 }}>{fmt(weekDates[0])} – {fmt(weekDates[6])}</div>
        </div>
        <button onClick={() => weekOffset < 0 && setWeekOffset(o => o + 1)} style={pagerBtn(weekOffset < 0)}>›</button>
      </div>
      {/* Week strip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {DAYS.map((d, i) => (
          <button key={d} onClick={() => setDay(i)} style={{
            flexShrink: 0, width: 48, padding: "10px 0", borderRadius: 14, border: "none", cursor: "pointer",
            background: day === i ? T.mintDark : weekOffset === 0 && i === TODAY ? T.mintLight : T.white,
            boxShadow: day === i ? shadow.md : shadow.sm, transition: "all .18s cubic-bezier(.34,1.56,.64,1)",
          }}>
            <div style={{ fontSize: 11, color: day === i ? T.mint : T.g4, fontWeight: 600, marginBottom: 4 }}>{d}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: day === i ? T.white : T.black }}>{weekDates[i].getDate()}</div>
            {weekOffset === 0 && i === TODAY && day !== i && <div style={{ width: 5, height: 5, borderRadius: 99, background: T.mintDark, margin: "4px auto 0" }} />}
          </button>
        ))}
      </div>
      {/* Daily summary for past days */}
      {isPast && (
        <div style={{ ...card, marginBottom: 12, padding: "16px 18px", animation: "popIn .25s ease both" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1 }}>📒 Daily Summary</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: histTotals.kcal <= TARGETS.kcal ? T.mintDark : T.warn }}>{histTotals.kcal} / {TARGETS.kcal} kcal</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {[["Protein", histTotals.protein, T.protein], ["Carbs", histTotals.carbs, T.carbs], ["Fat", histTotals.fat, T.fat]].map(([l, v, c]) => (
              <div key={l} style={{ flex: 1, background: T.g1, borderRadius: 10, padding: "8px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}g</div>
                <div style={{ fontSize: 10, color: T.g4, fontWeight: 500 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Meals accordion */}
      {types.map(type => {
        const meal = isPast ? history[type] : (MEALS.find(m => m.type === type) || MEALS[0]);
        const isOpen = expanded === type;
        const planned = isToday || isPast;
        return (
          <div key={type} style={{ marginBottom: 10 }}>
            <button onClick={() => setExpanded(isOpen ? null : type)} style={{
              width: "100%", ...card, padding: "14px 18px", border: "none", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>{planned ? meal.emoji : "✨"}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 11, color: T.g4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{type}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.black }}>{planned ? meal.name : "Not planned"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {planned && <span style={{ fontSize: 13, fontWeight: 700, color: T.g4 }}>{meal.kcal} kcal</span>}
                <span style={{ fontSize: 12, color: T.g4, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
              </div>
            </button>
            {isOpen && planned && (
              <div style={{ marginTop: 6, animation: "popIn .25s ease both" }}>
                <MealCard meal={meal} isFav={favorites.some(f => f.name === meal.name)} onFav={toggleFavorite} />
              </div>
            )}
            {isOpen && !planned && (
              <div style={{ ...card, marginTop: 6, padding: "20px", textAlign: "center", animation: "popIn .25s ease both" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
                <div style={{ fontSize: 14, color: T.g4 }}>No meal planned for this day.</div>
                <Btn label="Generate with AI" primary small onPress={() => setTab("ai")} style={{ marginTop: 12 }} />
              </div>
            )}
          </div>
        );
      })}
      {/* Daily fun fact */}
      <div style={{ ...card, marginTop: 16, background: T.mintLight, border: `1.5px solid ${T.mint}`, padding: "16px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.mintDark, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>💡 Did you know?</div>
        <div style={{ fontSize: 13, color: T.g6, lineHeight: 1.6 }}>{FUN_FACTS[day % FUN_FACTS.length]}</div>
      </div>
    </div>
  );
}

function AIScreen({ prefs, setPrefs, onSaveRecipe, pro, usage, useQuota, openPaywall }) {
  const [step, setStep] = useState("input"); // input | results
  const [ingredients, setIngredients] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [goal, setGoal] = useState("Muscle Gain");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [streamName, setStreamName] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  // The Anthropic key lives server-side in /api/generate — never in the browser.
  const apiKey = null;

  const addIng = val => {
    const t = val.trim().toLowerCase();
    if (t && !ingredients.includes(t)) setIngredients(p => [...p, t]);
    setInputVal("");
  };
  const handleKey = e => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const t = inputVal.trim().toLowerCase();
      addIng(t && !INGREDIENT_DB.includes(t) && suggestions.length ? suggestions[0] : inputVal);
    }
    else if (e.key === "Backspace" && inputVal === "" && ingredients.length > 0) setIngredients(p => p.slice(0, -1));
  };
  const togglePref = id => setPrefs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const q = inputVal.trim().toLowerCase();
  const suggestions = q
    ? INGREDIENT_DB.filter(x => x.includes(q) && !ingredients.includes(x))
        .sort((a, b) => (a.startsWith(q) ? 0 : 1) - (b.startsWith(q) ? 0 : 1))
        .slice(0, 6)
    : [];

  const generate = async () => {
    if (loading) return;
    if (!ingredients.length) {
      setError("Add at least one ingredient first — start typing to search, tap a quick-add, or 📷 Scan Fridge.");
      return;
    }
    if (!pro && usage.gen >= FREE_LIMITS.gen) { openPaywall(); return; }
    useQuota("gen");
    setError(null);
    setLoading(true); setError(null); setRecipes([]); setStreamName(null);
    const prefStr = prefs.length ? `Dietary requirements (strictly follow): ${prefs.join(", ")}.` : "";
    const prompt = `You are a professional nutritionist and chef. Generate exactly 3 different recipes using primarily: ${ingredients.join(", ")}.
Goal: ${goal}. ${prefStr}
You may add 1-2 basic pantry staples per recipe (salt, oil, common spices). Do NOT add major ingredients.
Respond ONLY with valid JSON — no markdown, no explanation:
{"recipes":[{"name":"","difficulty":"Easy","prepTime":"","servings":2,"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"ingredients":["1 lb chicken breast"],"steps":[""]}]}
Rules: difficulty is Easy/Medium/Hard; macros are realistic per-serving integers; 4-7 steps each; "ingredients" is 4-8 shopping-list items with quantities; 3 recipes meaningfully different in cuisine or method.`;
    setStep("results");
    try {
      const all = await streamRecipes(apiKey, prompt, ({ complete, partialName }) => {
        setRecipes(complete);
        setStreamName(partialName);
      });
      setRecipes(all);
      setStreamName(null);
    } catch {
      setStep("input");
      setError("Couldn't generate recipes — please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleFridgePhoto = e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!pro && usage.scan >= FREE_LIMITS.scan) { openPaywall(); return; }
    useQuota("scan");
    if (file.size > 4 * 1024 * 1024) { setError("That photo is over 4MB — try a smaller or compressed one."); return; }
    setScanning(true); setError(null);
    const fr = new FileReader();
    fr.onerror = () => { setScanning(false); setError("Couldn't read that photo — try another one."); };
    fr.onload = async () => {
      try {
        const base64 = String(fr.result).split(",")[1];
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-6", max_tokens: 300,
            messages: [{ role: "user", content: [
              { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } },
              { type: "text", text: 'List only the food ingredients visible. Respond ONLY with JSON: {"ingredients":["item1","item2"]}' },
            ] }],
          }),
        });
        if (!res.ok) throw new Error("scan failed");
        const data = await res.json();
        const text = (data.content || []).map(b => b.text || "").join("");
        const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
        const found = (parsed.ingredients || []).map(s => String(s).trim().toLowerCase()).filter(Boolean);
        if (!found.length) setError("No ingredients spotted — try a clearer, closer photo.");
        else setIngredients(p => [...p, ...found.filter(f => !p.includes(f))]);
      } catch {
        setError("Fridge scan failed — please try again.");
      } finally {
        setScanning(false);
      }
    };
    fr.readAsDataURL(file);
  };

  if (step === "results") return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={() => setStep("input")} style={{ width: 36, height: 36, borderRadius: 99, background: T.g1, border: "none", cursor: "pointer", fontSize: 18 }}>←</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.black, letterSpacing: -0.3 }}>Your Recipes</div>
          <div style={{ fontSize: 12, color: T.g4 }}>
            {loading ? `Cooking up ideas for ${goal}…` : `${ingredients.slice(0, 3).join(", ")}${ingredients.length > 3 ? ` +${ingredients.length - 3} more` : ""}`}
          </div>
        </div>
      </div>
      {recipes.map((r, i) => <AICard key={i} recipe={r} index={i} onSave={onSaveRecipe} onReplace={(idx, next) => setRecipes(prev => prev.map((x, j) => j === idx ? next : x))} />)}
      {loading && recipes.length < 3 && (
        <div style={{ ...card, border: `1.5px dashed ${T.mintMid}`, background: T.mintLight, marginBottom: 14, padding: "18px", animation: "fadeUp 0.4s ease both" }}>
          {streamName ? (
            <div style={{ fontSize: 16, fontWeight: 800, color: T.mintDark, marginBottom: 6 }}>{streamName}</div>
          ) : (
            <div style={{ fontSize: 16, fontWeight: 800, color: T.mintDark, marginBottom: 6 }}>Thinking…</div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, display: "inline-block", animation: "spin 2s linear infinite" }}>🌀</span>
            <span style={{ fontSize: 13, color: T.g5 }}>Writing recipe {recipes.length + 1} of 3…</span>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.mintDark, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>AI Meal Generator</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.black, letterSpacing: -0.4 }}>What's in your kitchen?</div>
      </div>

      {/* Ingredient chips input */}
      <div style={{ ...card, padding: "16px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1 }}>Your Ingredients</div>
          <button onClick={() => { if (scanning) return; if (!pro && usage.scan >= FREE_LIMITS.scan) { openPaywall(); return; } if (fileRef.current) fileRef.current.click(); }} style={{
            border: `1.5px solid ${T.mintMid}`, background: T.mintLight, color: T.mintDark, borderRadius: 99,
            padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: scanning ? 0.7 : 1,
          }}>{scanning ? "⏳ Scanning…" : "📷 Scan Fridge"}</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFridgePhoto} style={{ display: "none" }} />
        <div onClick={() => inputRef.current?.focus()} style={{
          minHeight: 54, border: `1.5px solid ${T.g2}`, borderRadius: 14, padding: "10px 14px",
          display: "flex", flexWrap: "wrap", gap: 7, alignItems: "flex-start", cursor: "text", background: T.g1,
        }}>
          {ingredients.map(ing => (
            <span key={ing} style={{ background: T.mintDark, color: T.white, borderRadius: 99, padding: "5px 12px 5px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
              {ing}
              <button onClick={e => { e.stopPropagation(); setIngredients(p => p.filter(i => i !== ing)); }}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: T.white, cursor: "pointer", padding: 0, fontSize: 14, width: 18, height: 18, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </span>
          ))}
          <input ref={inputRef} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={handleKey}
            onBlur={() => inputVal.trim() && addIng(inputVal)}
            placeholder={!ingredients.length ? "Search ingredients — try 'chick'..." : ""}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, color: T.black, minWidth: 160, flex: 1, padding: "4px 0" }}
          />
        </div>
        {/* Autocomplete suggestions */}
        {suggestions.length > 0 && (
          <div style={{ marginTop: 8, background: T.white, border: `1.5px solid ${T.g2}`, borderRadius: 14, overflow: "hidden", boxShadow: shadow.md, animation: "popIn .25s ease both" }}>
            {suggestions.map((s, i) => (
              <button key={s} onMouseDown={e => e.preventDefault()} onClick={() => { addIng(s); inputRef.current?.focus(); }} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "11px 14px",
                border: "none", background: "transparent", cursor: "pointer", fontSize: 14, color: T.black,
                borderBottom: i < suggestions.length - 1 ? `1px solid ${T.g1}` : "none",
              }}>
                <span style={{ color: T.mintDark, fontWeight: 800 }}>+</span>
                <span>{s.startsWith(q) ? (<><strong>{s.slice(0, q.length)}</strong>{s.slice(q.length)}</>) : s}</span>
              </button>
            ))}
          </div>
        )}
        {/* Quick adds */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {["chicken","rice","broccoli","eggs","avocado"].filter(i => !ingredients.includes(i)).map(s => (
            <button key={s} onClick={() => setIngredients(p => [...p, s])} style={{
              padding: "5px 12px", borderRadius: 99, border: `1.5px dashed ${T.g3}`,
              background: "transparent", color: T.g4, fontSize: 12, cursor: "pointer", fontWeight: 500,
              transition: "all .18s cubic-bezier(.34,1.56,.64,1)",
            }}>+ {s}</button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: T.g4, marginTop: 8 }}>Tip: start typing to search · tap a match to add it · or 📷 scan a photo of your fridge</div>
      </div>

      {/* Goal selector */}
      <div style={{ ...card, marginBottom: 14, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Nutrition Goal</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {GOAL_OPTS.map(g => (
            <button key={g} onClick={() => setGoal(g)} style={{
              padding: "8px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: goal === g ? T.mintDark : T.g1, color: goal === g ? T.white : T.g5, transition: "all .18s cubic-bezier(.34,1.56,.64,1)",
            }}>{g}</button>
          ))}
        </div>
      </div>

      {/* Dietary preferences */}
      <div style={{ ...card, marginBottom: 14, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Dietary Preferences</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {DIETARY_OPTS.map(p => {
            const active = prefs.includes(p);
            return (
              <button key={p} onClick={() => togglePref(p)} style={{
                padding: "7px 14px", borderRadius: 99, cursor: "pointer", fontSize: 13, fontWeight: 500,
                border: active ? `2px solid ${T.mintDark}` : `1.5px solid ${T.g2}`,
                background: active ? T.mintLight : T.white, color: active ? T.mintDark : T.g4, transition: "all .18s cubic-bezier(.34,1.56,.64,1)",
              }}>{active ? "✓ " : ""}{p}</button>
            );
          })}
        </div>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 16px", marginBottom: 14, color: T.error, fontSize: 13 }}>⚠️ {error}</div>}

      <Btn label={loading ? "⏳ Generating..." : ingredients.length ? `✨ Generate 3 Recipes (${ingredients.length} ingredient${ingredients.length > 1 ? "s" : ""})` : "Add ingredients to generate"} primary
        onPress={generate} style={{ width: "100%", opacity: !ingredients.length ? 0.6 : 1 }} />
      {!pro && (
        <div style={{ textAlign: "center", fontSize: 12, color: T.g4, marginTop: 10 }}>
          {Math.max(0, FREE_LIMITS.gen - usage.gen)} of {FREE_LIMITS.gen} free generations · {Math.max(0, FREE_LIMITS.scan - usage.scan)} of {FREE_LIMITS.scan} free scan left today{" "}
          <span onClick={openPaywall} style={{ color: T.mintDark, fontWeight: 700, cursor: "pointer" }}>· Go Pro ♾️</span>
        </div>
      )}
    </div>
  );
}
function guessCategory(name) {
  const n = name.toLowerCase();
  const has = list => list.some(k => n.includes(k));
  if (has(["chicken","beef","turkey","salmon","tuna","shrimp","fish","pork","bacon","egg","tofu","steak","yogurt"])) return "Proteins";
  if (has(["broccoli","spinach","pepper","onion","garlic","tomato","carrot","zucchini","mushroom","asparagus","bean","cauliflower","potato","corn","pea","cucumber","lettuce","kale","cabbage","celery","avocado"])) return "Vegetables";
  if (has(["rice","quinoa","oat","pasta","bread","tortilla","couscous","cereal","flour"])) return "Grains";
  if (has(["berr","banana","apple","lemon","lime","orange","mango","pineapple","grape","peach","melon","fruit"])) return "Fruits";
  if (has(["milk","cheese","butter","cream","dairy"])) return "Dairy";
  return "Other";
}

function GroceryRow({ item, onToggle }) {
  return (
    <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.g1}`, cursor: "pointer" }}>
      <div style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${item.done ? T.mintDark : T.g3}`, background: item.done ? T.mintDark : T.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}>
        {item.done && <span style={{ color: T.white, fontSize: 13, fontWeight: 700 }}>✓</span>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: item.done ? T.g4 : T.black, textDecoration: item.done ? "line-through" : "none" }}>{item.name}</div>
        {item.qty ? <div style={{ fontSize: 12, color: T.g4 }}>{item.qty}</div> : null}
      </div>
    </div>
  );
}

function GroceryScreen({ items, setItems }) {
  const [newItem, setNewItem] = useState("");
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const toggle = id => setItems(p => p.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    if (items.some(i => i.name.toLowerCase() === t.toLowerCase())) { setNewItem(""); return; }
    setItems(p => [...p, { id: Date.now(), name: t.charAt(0).toUpperCase() + t.slice(1), qty: "", cat: guessCategory(t), done: false }]);
    setNewItem("");
  };
  const active = items.filter(i => !i.done);
  const inCart = items.filter(i => i.done);
  const CAT_EMOJI = { "From Recipes": "🌿", Proteins: "🥩", Vegetables: "🥦", Grains: "🌾", Fruits: "🍎", Dairy: "🥛", Other: "🛒" };
  const cats = Object.keys(CAT_EMOJI).filter(c => active.some(i => i.cat === c));

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.black, marginBottom: 6, letterSpacing: -0.3 }}>Grocery List</div>
      <div style={{ ...card, background: T.mintLight, border: `1.5px solid ${T.mint}`, padding: "12px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: T.g6, lineHeight: 1.55 }}>
          <strong style={{ color: T.mintDark }}>What is this?</strong> Your shopping list for this week's meals. Tap items to check them off as you shop — and when you hit Save on an AI recipe, its ingredients land here automatically.
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.g4, marginBottom: 6 }}>
        <span>{done} of {total} in cart</span>
        <span style={{ fontWeight: 700, color: T.mintDark }}>{total ? Math.round((done / total) * 100) : 0}%</span>
      </div>
      <div style={{ height: 6, background: T.g2, borderRadius: 99, marginBottom: 16, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${total ? (done / total) * 100 : 0}%`, background: T.mintDark, borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={newItem} onChange={e => setNewItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()}
          placeholder="Add an item — e.g. almond milk"
          style={{ flex: 1, border: `1.5px solid ${T.g2}`, borderRadius: 12, padding: "12px 14px", fontSize: 14, outline: "none", background: T.white, color: T.black }} />
        <Btn label="+ Add" primary small onPress={addItem} style={{ padding: "10px 18px" }} />
      </div>
      {cats.map(cat => (
        <div key={cat} style={{ ...card, marginBottom: 10, padding: "12px 18px", animation: "slideUp .3s cubic-bezier(.22,.68,0,1) both" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0 2px" }}>
            <span style={{ fontSize: 16 }}>{CAT_EMOJI[cat]}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1 }}>{cat}</span>
          </div>
          {active.filter(i => i.cat === cat).map(i => <GroceryRow key={i.id} item={i} onToggle={() => toggle(i.id)} />)}
        </div>
      ))}
      {active.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: "28px 20px", marginBottom: 10 }}>
          <div style={{ fontSize: 26, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 14, color: T.g5 }}>All done — everything is in your cart!</div>
        </div>
      )}
      {inCart.length > 0 && (
        <div style={{ ...card, marginTop: 6, padding: "12px 18px", background: T.mintLight, animation: "slideUp .3s cubic-bezier(.22,.68,0,1) both" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.mintDark, textTransform: "uppercase", letterSpacing: 1, padding: "4px 0 2px" }}>✓ In cart ({inCart.length})</div>
          {inCart.map(i => <GroceryRow key={i.id} item={i} onToggle={() => toggle(i.id)} />)}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onFlip }) {
  return (
    <div onClick={onFlip} style={{ width: 46, height: 28, borderRadius: 99, background: on ? T.mintDark : T.g2, position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 99, background: T.white, boxShadow: shadow.sm, transition: "left 0.2s" }} />
    </div>
  );
}

function WeightChart({ data }) {
  const w = 200, h = 64, pad = 8;
  const vals = data.map(d => d.w);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = data.map((d, i) => [
    pad + i * ((w - 2 * pad) / Math.max(data.length - 1, 1)),
    h - pad - ((d.w - min) / range) * (h - 2 * pad),
  ]);
  const line = pts.map(pt => pt.map(n => Math.round(n * 10) / 10).join(",")).join(" ");
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      <polyline points={line} fill="none" stroke={T.mint} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((pt, i) => (
        <circle key={i} cx={pt[0]} cy={pt[1]} r={i === pts.length - 1 ? 4 : 2.5}
          fill={i === pts.length - 1 ? "#FFFFFF" : T.mint} stroke={T.mint} strokeWidth={i === pts.length - 1 ? 2 : 0} />
      ))}
    </svg>
  );
}

function ProfileScreen({ units, setUnits, weights, setWeights, prefs, setPrefs, pro, openPaywall, favorites, setFavorites, tryList, setTryList }) {
  const [sub, setSub] = useState(null);
  const [logVal, setLogVal] = useState("");
  const [notif, setNotif] = useState({ "Meal Reminders": true, "Water Reminders": true, "Weekly Progress Report": false, "Streak Alerts": true, "AI Recipe Suggestions": true });
  const [connected, setConnected] = useState({});
  const [faqOpen, setFaqOpen] = useState(null);
  const [tryOpen, setTryOpen] = useState(null);

  const lbs = weights[weights.length - 1].w;
  const disp = v => units === "metric" ? `${Math.round(v * 0.45359 * 10) / 10} kg` : `${Math.round(v * 10) / 10} lbs`;
  const delta = Math.round((lbs - weights[0].w) * 10) / 10;

  const logWeight = () => {
    const n = parseFloat(logVal);
    if (!n || n <= 0) return;
    const asLbs = units === "metric" ? Math.round((n / 0.45359) * 10) / 10 : n;
    const label = NOW.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    setWeights(prev => [...prev.slice(-11), { d: label, w: asLbs }]);
    setLogVal("");
  };

  if (sub) return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={() => setSub(null)} style={{ width: 36, height: 36, borderRadius: 99, background: T.g1, border: "none", cursor: "pointer", fontSize: 18 }}>←</button>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.black, letterSpacing: -0.3 }}>{sub}</div>
      </div>

      {sub === "Notification Preferences" && (
        <div style={{ ...card, padding: "6px 18px" }}>
          {Object.keys(notif).map((k, i, arr) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.g1}` : "none" }}>
              <span style={{ fontSize: 15, color: T.black, fontWeight: 500 }}>{k}</span>
              <Toggle on={notif[k]} onFlip={() => setNotif(prev => ({ ...prev, [k]: !prev[k] }))} />
            </div>
          ))}
        </div>
      )}

      {sub === "Dietary Restrictions" && (
        <div>
          <div style={{ fontSize: 13, color: T.g4, marginBottom: 12, lineHeight: 1.5 }}>Synced with the AI Generator — anything you toggle here is applied to every recipe you generate.</div>
          <div style={{ ...card, padding: "16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {DIETARY_OPTS.map(o => {
                const active = prefs.includes(o);
                return (
                  <button key={o} onClick={() => setPrefs(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o])} style={{
                    padding: "7px 14px", borderRadius: 99, cursor: "pointer", fontSize: 13, fontWeight: 500,
                    border: active ? `2px solid ${T.mintDark}` : `1.5px solid ${T.g2}`,
                    background: active ? T.mintLight : T.white, color: active ? T.mintDark : T.g4, transition: "all .18s cubic-bezier(.34,1.56,.64,1)",
                  }}>{active ? "✓ " : ""}{o}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {sub === "Connected Apps" && (
        <div style={{ ...card, padding: "6px 18px" }}>
          {["🍎 Apple Health", "⌚ Garmin Connect", "🏃 Google Fit", "🥗 MyFitnessPal"].map((a, i, arr) => (
            <div key={a} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${T.g1}` }}>
              <span style={{ fontSize: 15, color: T.black, fontWeight: 500 }}>{a}</span>
              <Btn small label={connected[a] ? "Requested ✓" : "Connect"} onPress={() => setConnected(prev => ({ ...prev, [a]: true }))}
                style={connected[a] ? { background: T.mintLight, color: T.mintDark } : {}} />
            </div>
          ))}
          <div style={{ fontSize: 12, color: T.g4, padding: "12px 0", lineHeight: 1.5 }}>Health integrations are on the roadmap — connecting now registers your interest so weight and activity can sync automatically.</div>
        </div>
      )}

      {sub === "Privacy Settings" && (
        <div style={{ ...card, padding: "18px" }}>
          {[
            ["Your data stays with you", "Meals, weight logs, and preferences live in this app session only. Nothing is stored on our servers."],
            ["What we send to Claude", "Only your ingredient list, nutrition goal, dietary preferences, and fridge photos — solely to generate recipes. Photos are never stored."],
            ["No ads, no selling data", "NutriCook AI does not sell, share, or monetize your personal data. Ever."],
            ["Your controls", "Clear all data anytime by refreshing the app, and disconnect any linked service from Connected Apps."],
          ].map(([h, b], i, arr) => (
            <div key={h} style={{ marginBottom: i < arr.length - 1 ? 16 : 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.black, marginBottom: 4 }}>{h}</div>
              <div style={{ fontSize: 13, color: T.g5, lineHeight: 1.6 }}>{b}</div>
            </div>
          ))}
        </div>
      )}

      {sub === "Help & Support" && (
        <div>
          <div style={{ ...card, padding: "6px 18px", marginBottom: 14 }}>
            {[
              ["How do recipes get generated?", "Claude AI reads your ingredients, goal, and dietary preferences, then writes 3 recipes with realistic nutrition estimates — streamed live as it thinks."],
              ["Why did my fridge scan miss items?", "Lighting and angle matter. Get close, keep items visible, and retake — you can always type missed items and the search will autocomplete them."],
              ["How does the grocery list work?", "Tap Save on any generated recipe and its ingredients drop into your Grocery tab under From Recipes. Add your own items with the + Add box."],
              ["Is my data private?", "Yes — see Privacy Settings. Only recipe inputs are sent to the AI, and nothing is stored."],
            ].map(([q, a], i, arr) => (
              <div key={q} style={{ borderBottom: i < arr.length - 1 ? `1px solid ${T.g1}` : "none" }}>
                <button onClick={() => setFaqOpen(faqOpen === q ? null : q)} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "14px 0", fontSize: 14, fontWeight: 600, color: T.black, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <span>{q}</span>
                  <span style={{ color: T.g4, fontSize: 11, transform: faqOpen === q ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>▼</span>
                </button>
                {faqOpen === q && <div style={{ fontSize: 13, color: T.g5, lineHeight: 1.6, paddingBottom: 14, animation: "popIn .25s ease both" }}>{a}</div>}
              </div>
            ))}
          </div>
          <div style={{ ...card, padding: "16px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 13, color: T.g5, marginBottom: 4 }}>Still stuck? We answer fast.</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.mintDark }}>support@nutricook.ai</div>
          </div>
        </div>
      )}
      {sub === "Favorite Dishes" && (
        favorites.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "32px 20px" }}>
            <div style={{ fontSize: 28, marginBottom: 8, color: T.g3 }}>♡</div>
            <div style={{ fontSize: 14, color: T.g4, lineHeight: 1.6 }}>No favorites yet — tap the ♡ on any meal.</div>
          </div>
        ) : (
          favorites.map((f, i) => (
            <div key={f.name} style={{ ...card, padding: "14px 18px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12, animation: "slideUp .35s cubic-bezier(.22,.68,0,1) both", animationDelay: `${i * 0.05}s` }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: T.mintLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{f.emoji}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.black, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.black }}>{f.kcal} kcal</span>
                  <Pill text={`P ${f.protein}g`} color={T.protein} bg={T.g1} size={10} />
                  <Pill text={`C ${f.carbs}g`} color={T.carbs} bg={T.g1} size={10} />
                  <Pill text={`F ${f.fat}g`} color={T.fat} bg={T.g1} size={10} />
                </div>
              </div>
              <button onClick={() => setFavorites(p => p.filter(x => x.name !== f.name))} style={{ width: 28, height: 28, borderRadius: 99, border: "none", background: T.g1, color: T.g4, cursor: "pointer", fontSize: 13, flexShrink: 0, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}>✕</button>
            </div>
          ))
        )
      )}

      {sub === "Want to Try" && (
        tryList.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "32px 20px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔖</div>
            <div style={{ fontSize: 14, color: T.g4, lineHeight: 1.6 }}>Recipes you Save from the AI generator land here.</div>
          </div>
        ) : (
          tryList.map((r, i) => {
            const isOpen = tryOpen === r.name;
            const diffBg = { Easy: T.success, Medium: T.warn, Hard: T.error }[r.difficulty] || T.success;
            return (
              <div key={r.name} style={{ ...card, padding: "14px 18px", marginBottom: 10, animation: "slideUp .35s cubic-bezier(.22,.68,0,1) both", animationDelay: `${i * 0.05}s` }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.black, lineHeight: 1.3 }}>{r.name}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.black }}>{r.macros ? r.macros.calories : "—"} kcal</span>
                      <Pill text={r.difficulty} color="#1A3A2A" bg={diffBg} size={10} />
                    </div>
                  </div>
                  <button onClick={() => setTryList(p => p.filter(x => x.name !== r.name))} style={{ width: 28, height: 28, borderRadius: 99, border: "none", background: T.g1, color: T.g4, cursor: "pointer", fontSize: 13, flexShrink: 0, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}>✕</button>
                </div>
                <button onClick={() => setTryOpen(isOpen ? null : r.name)} style={{
                  width: "100%", marginTop: 10, background: isOpen ? T.mintLight : T.g1, border: `1.5px solid ${isOpen ? T.mint : T.g2}`,
                  borderRadius: 12, padding: "9px 14px", cursor: "pointer", display: "flex",
                  justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 700, color: T.mintDark,
                }}>
                  <span>{isOpen ? "Hide" : "Show"} Steps ({(r.steps || []).length})</span>
                  <span style={{ fontSize: 10, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
                </button>
                {isOpen && (
                  <ol style={{ margin: "12px 0 0", padding: 0, animation: "popIn .25s ease both" }}>
                    {(r.steps || []).map((s, j) => (
                      <li key={j} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                        <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, background: T.mintDark, color: T.white, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{j + 1}</span>
                        <span style={{ fontSize: 13, color: T.g6, lineHeight: 1.6 }}>{s}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            );
          })
        )
      )}
    </div>
  );

  const statRows = [
    { icon: "⚖️", label: "Current Weight", value: disp(lbs) },
    { icon: "🎯", label: "Target Weight", value: disp(USER.targetLbs) },
    { icon: "🔥", label: "Daily Calories", value: `${TARGETS.kcal} kcal` },
    { icon: "💪", label: "Daily Protein", value: `${TARGETS.protein}g` },
    { icon: "📅", label: "Current Streak", value: `${USER.streak} days` },
  ];
  const settingRows = ["Notification Preferences","Dietary Restrictions","Connected Apps","Privacy Settings","Help & Support"];
  return (
    <div style={{ padding: "16px" }}>
      {/* Profile header: identity left, weight trend right */}
      <div style={{ ...card, background: `linear-gradient(135deg, #0E2A1C 0%, #1A8C5F 100%)`, padding: "20px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: 99, background: `linear-gradient(135deg, ${T.mint}, ${T.mintDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 8px" }}>💪</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.white }}>{USER.name}{pro && <span style={{ marginLeft: 6, background: T.mint, color: "#0E2A1C", borderRadius: 99, padding: "1px 7px", fontSize: 9, fontWeight: 800, verticalAlign: "middle", letterSpacing: 0.5 }}>PRO</span>}</div>
            <div style={{ display: "inline-block", background: "rgba(168,245,211,0.2)", borderRadius: 99, padding: "3px 10px", marginTop: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.mint }}>🎯 {USER.goal}</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: 1 }}>Weight Trend</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: T.mint }}>{disp(lbs)}</span>
            </div>
            <WeightChart data={weights} />
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
              {weights[0].d} → {weights[weights.length - 1].d} · {delta >= 0 ? "+" : ""}{units === "metric" ? `${Math.round(delta * 0.45359 * 10) / 10} kg` : `${delta} lbs`}
            </div>
          </div>
        </div>
      </div>

      {/* My Goals */}
      <div style={{ ...card, marginBottom: 14, padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.black }}>My Goals</div>
          <div style={{ display: "flex", background: T.g1, borderRadius: 99, padding: 3 }}>
            {["imperial", "metric"].map(u => (
              <button key={u} onClick={() => setUnits(u)} style={{ border: "none", cursor: "pointer", borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 700, background: units === u ? T.mintDark : "transparent", color: units === u ? T.white : T.g4, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}>{u === "imperial" ? "lbs" : "kg"}</button>
            ))}
          </div>
        </div>
        {statRows.map((s, i) => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${T.g1}` }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <span style={{ fontSize: 15, color: T.g5, fontWeight: 500 }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.black }}>{s.value}</span>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, alignItems: "center", paddingTop: 14 }}>
          <input value={logVal} onChange={e => setLogVal(e.target.value)} inputMode="decimal"
            placeholder={units === "metric" ? "Log today's weight (kg)" : "Log today's weight (lbs)"}
            onKeyDown={e => e.key === "Enter" && logWeight()}
            style={{ flex: 1, border: `1.5px solid ${T.g2}`, borderRadius: 12, padding: "10px 14px", fontSize: 14, outline: "none", background: T.g1, color: T.black }} />
          <Btn label="Log" primary small onPress={logWeight} />
        </div>
      </div>

      {/* Macro split */}
      <div style={{ ...card, marginBottom: 14, padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.black, marginBottom: 14 }}>Macro Split</div>
        <MacroBar label="Protein" value={TARGETS.protein} max={TARGETS.protein + TARGETS.carbs + TARGETS.fat} color={T.protein} />
        <MacroBar label="Carbohydrates" value={TARGETS.carbs} max={TARGETS.protein + TARGETS.carbs + TARGETS.fat} color={T.carbs} />
        <MacroBar label="Fat" value={TARGETS.fat} max={TARGETS.protein + TARGETS.carbs + TARGETS.fat} color={T.fat} />
      </div>

      {/* Achievement badges */}
      <div style={{ ...card, marginBottom: 14, padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.black, marginBottom: 14 }}>Achievements</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-around" }}>
          {ACHIEVEMENTS.map(a => (
            <div key={a.label} style={{ textAlign: "center", width: 76 }}>
              <div style={{ width: 60, height: 60, margin: "0 auto 7px", borderRadius: 99, background: `linear-gradient(135deg, ${T.mint}, ${T.mintDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, boxShadow: shadow.md, border: `3px solid ${T.white}`, outline: `2px solid ${T.mint}` }}>{a.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.g5, lineHeight: 1.3 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* My Recipe Box */}
      <div style={{ ...card, marginBottom: 14, padding: "6px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.black, padding: "12px 0 2px" }}>My Recipe Box</div>
        {[["♥ Favorite Dishes", favorites.length, "Favorite Dishes"], ["🔖 Want to Try", tryList.length, "Want to Try"]].map(([label, count, target], i, arr) => (
          <div key={target} onClick={() => setSub(target)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.g1}` : "none", cursor: "pointer" }}>
            <span style={{ fontSize: 15, color: T.black, fontWeight: 500 }}>{label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: T.mintLight, color: T.mintDark, fontSize: 12, fontWeight: 700, borderRadius: 99, padding: "2px 10px" }}>{count}</span>
              <span style={{ color: T.g3, fontSize: 18 }}>›</span>
            </div>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div style={{ ...card, marginBottom: 14, padding: "6px 18px" }}>
        {settingRows.map((s, i) => (
          <div key={s} onClick={() => setSub(s)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: i < settingRows.length - 1 ? `1px solid ${T.g1}` : "none", cursor: "pointer" }}>
            <span style={{ fontSize: 15, color: T.black, fontWeight: 500 }}>{s}</span>
            <span style={{ color: T.g3, fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>

      {!pro && (
        <div onClick={openPaywall} style={{ ...card, marginBottom: 14, padding: "14px 18px", background: `linear-gradient(135deg, #0E2A1C 0%, #1A8C5F 100%)`, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.white }}>🌿 Upgrade to NutriCook Pro</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>Unlimited recipes, scans & remixes — $4.99/mo</div>
          </div>
          <span style={{ color: T.mint, fontSize: 18 }}>›</span>
        </div>
      )}
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <div style={{ fontSize: 12, color: T.g4 }}>NutriCook AI · v2.5</div>
        <div style={{ fontSize: 11, color: T.g3, marginTop: 2 }}>Powered by Claude AI</div>
      </div>
    </div>
  );
}

// ── Paywall ──────────────────────────────────────────────
const FREE_LIMITS = { gen: 3, scan: 1 };

function Paywall({ onClose, onUpgrade, busy }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 50, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", background: T.white, borderRadius: "24px 24px 0 0", padding: "24px 22px 28px", animation: "fadeUp 0.3s ease both" }}>
        <div style={{ width: 40, height: 4, borderRadius: 99, background: T.g2, margin: "0 auto 18px" }} />
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 34, marginBottom: 6 }}>🌿</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.black, letterSpacing: -0.3 }}>NutriCook Pro</div>
          <div style={{ fontSize: 14, color: T.g4, marginTop: 4 }}>You've used your free portions for today</div>
        </div>
        <div style={{ background: T.mintLight, border: `1.5px solid ${T.mint}`, borderRadius: 16, padding: "14px 16px", marginBottom: 16 }}>
          {[
            ["♾️", "Unlimited AI recipe generation"],
            ["📷", "Unlimited fridge scans to your pantry"],
            ["🌶", "Unlimited recipe remixes"],
            ["⚡", "Priority generation speed"],
          ].map(([e, t]) => (
            <div key={t} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0" }}>
              <span style={{ fontSize: 16 }}>{e}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: T.g6 }}>{t}</span>
            </div>
          ))}
        </div>
        <Btn label={busy ? "⏳ Opening checkout…" : "Start Pro — $4.99/mo"} primary onPress={busy ? () => {} : onUpgrade} style={{ width: "100%", marginBottom: 10 }} />
        <button onClick={onClose} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, color: T.g4, padding: "8px" }}>Maybe later</button>
        <div style={{ fontSize: 11, color: T.g4, textAlign: "center", marginTop: 6 }}>Unlimited until your next billing date. Cancel anytime.</div>
      </div>
    </div>
  );
}

// ── Bottom Nav ───────────────────────────────────────────
const NAV = [
  { id: "home", icon: "⊙", label: "Home" },
  { id: "plan", icon: "📅", label: "Plan" },
  { id: "ai", icon: "🌿", label: "", fab: true },
  { id: "grocery", icon: "🛒", label: "Grocery" },
  { id: "profile", icon: "👤", label: "Profile" },
];

function BottomNav({ tab, setTab }) {
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)",
      borderTop: `1px solid ${T.g2}`, paddingBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-end", height: 64 }}>
        {NAV.map(n => n.fab ? (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
            border: "none", background: "transparent", cursor: "pointer", paddingBottom: 10,
          }}>
            <div style={{
              width: 54, height: 54, borderRadius: 99, marginTop: -18,
              background: tab === n.id ? T.mintDark : `linear-gradient(135deg, ${T.mintDark}, ${T.mintMid})`,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
              boxShadow: `0 4px 16px rgba(30,140,95,0.4)`,
              animation: "pulseGlow 2.6s ease-in-out infinite",
              transition: "transform .25s cubic-bezier(.34,1.56,.64,1)", transform: tab === n.id ? "scale(1.08)" : "scale(1)",
            }}>🌿</div>
          </button>
        ) : (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            border: "none", background: "transparent", cursor: "pointer", height: "100%", gap: 3, paddingTop: 6,
          }}>
            <span style={{ fontSize: 20, filter: tab === n.id ? "none" : "grayscale(1) opacity(0.5)", transition: "transform .25s cubic-bezier(.34,1.56,.64,1), filter .2s", transform: tab === n.id ? "translateY(-3px) scale(1.15)" : "translateY(0) scale(1)" }}>{n.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: tab === n.id ? T.mintDark : T.g4 }}>{n.label}</span>
            {tab === n.id && <div style={{ width: 4, height: 4, borderRadius: 99, background: T.mintDark }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────
export default function NutriCookApp() {
  const [tab, setTab] = useState("home");
  const scrollRef = useRef(null);
  const [prefs, setPrefs] = useState([]);
  const [units, setUnits] = useState("imperial");
  const [weights, setWeights] = useState(WEIGHT_SEED);
  const [groceryItems, setGroceryItems] = useState(() => Object.entries(GROCERY).flatMap(([cat, arr]) => arr.map(i => ({ ...i, cat }))));
  const [pro, setPro] = useState(false);
  const [usage, setUsage] = useState({ gen: 0, scan: 0 });
  const [paywall, setPaywall] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [tryList, setTryList] = useState([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("upgraded") === "1") {
      setPro(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);
  const useQuota = kind => setUsage(u => ({ ...u, [kind]: u[kind] + 1 }));
  const startCheckout = async () => {
    setCheckoutBusy(true);
    try {
      const res = await fetch("/api/checkout", { method: "POST" });
      const d = await res.json();
      if (d.url) { window.location.href = d.url; return; }
    } catch {}
    // Simulated mode (no Stripe keys configured): activate Pro directly.
    setPro(true);
    setPaywall(false);
    setCheckoutBusy(false);
  };
  const saveRecipeToGrocery = recipe => setGroceryItems(p => {
    const have = p.map(x => x.name.toLowerCase());
    const add = (recipe.ingredients || [])
      .map(n => String(n).trim())
      .filter(n => n && !have.includes(n.toLowerCase()))
      .map((n, i) => ({ id: Date.now() + i, name: n.charAt(0).toUpperCase() + n.slice(1), qty: "", cat: "From Recipes", done: false }));
    return [...p, ...add];
  });
  const toggleFavorite = meal => setFavorites(p => p.some(f => f.name === meal.name)
    ? p.filter(f => f.name !== meal.name)
    : [...p, { name: meal.name, emoji: meal.emoji, kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat }]);
  // Saving an AI recipe: grocery ingredients + Want-to-Try list, deduped by name.
  const onSaveRecipe = recipe => {
    saveRecipeToGrocery(recipe);
    setTryList(p => p.some(r => r.name === recipe.name) ? p : [...p, recipe]);
  };
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [tab]);

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn { 0% { opacity:0; transform:scale(.92); } 70% { opacity:1; transform:scale(1.015); } 100% { opacity:1; transform:scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulseGlow { 0%, 100% { box-shadow: 0 4px 16px rgba(30,140,95,0.4); } 50% { box-shadow: 0 6px 26px rgba(30,140,95,0.65); } }
        * { box-sizing: border-box; }
        body { margin: 0; background: #1C1C1E; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #C7C7CC; border-radius: 99px; }
      `}</style>

      <div style={{ maxWidth: 430, margin: "0 auto", height: "100vh", background: T.bg, position: "relative", overflow: "hidden", fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif" }}>
        {/* Status bar */}
        <div style={{ background: T.white, padding: "12px 20px 8px", display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: T.black, borderBottom: `1px solid ${T.g1}` }}>
          <span>9:41</span>
          <span style={{ fontSize: 11, color: T.mintDark, fontWeight: 700, letterSpacing: 0.5 }}>NUTRICOOK AI</span>
          {pro ? <span style={{ background: T.mintDark, color: T.white, borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>PRO</span> : <span>● ● ▮</span>}
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ height: "calc(100vh - 36px - 72px)", overflowY: "auto", overflowX: "hidden" }}>
          <div key={tab} style={{ animation: "slideUp 0.32s cubic-bezier(.22,.68,0,1) both" }}>
          {tab === "home" && <HomeScreen setTab={setTab} favorites={favorites} toggleFavorite={toggleFavorite} />}
          {tab === "plan" && <PlanScreen setTab={setTab} favorites={favorites} toggleFavorite={toggleFavorite} />}
          {tab === "ai" && <AIScreen prefs={prefs} setPrefs={setPrefs} onSaveRecipe={onSaveRecipe} pro={pro} usage={usage} useQuota={useQuota} openPaywall={() => setPaywall(true)} />}
          {tab === "grocery" && <GroceryScreen items={groceryItems} setItems={setGroceryItems} />}
          {tab === "profile" && <ProfileScreen units={units} setUnits={setUnits} weights={weights} setWeights={setWeights} prefs={prefs} setPrefs={setPrefs} pro={pro} openPaywall={() => setPaywall(true)} favorites={favorites} setFavorites={setFavorites} tryList={tryList} setTryList={setTryList} />}
          </div>
        </div>

        <BottomNav tab={tab} setTab={setTab} />
        {paywall && <Paywall onClose={() => setPaywall(false)} onUpgrade={startCheckout} busy={checkoutBusy} />}
      </div>
    </>
  );
}

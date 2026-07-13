import { useState, useEffect, useRef } from "react";

// ── Tokens ──────────────────────────────────────────────
const T = {
  mint: "#A8F5D3", mintMid: "#3EC98A", mintDark: "#1A8C5F", mintLight: "#F0FBF6",
  bg: "#F5F5F7", white: "#FFFFFF", black: "#1C1C1E",
  g1: "#F5F5F7", g2: "#E5E5EA", g3: "#C7C7CC", g4: "#8E8E93", g5: "#636366", g6: "#3A3A3C",
  success: "#34C759", warn: "#FF9500", error: "#FF3B30", blue: "#007AFF",
  protein: "#3EC98A", carbs: "#FFB340", fat: "#FF6B6B", water: "#5AC8FA",
};
const shadow = { sm: "0 1px 6px rgba(0,0,0,0.06)", md: "0 2px 16px rgba(0,0,0,0.08)" };
const card = { background: T.white, borderRadius: 20, padding: "20px", boxShadow: shadow.md };

// ── Static Data ──────────────────────────────────────────
const USER = { name: "Cesar", goal: "Muscle Gain", weight: "175 lbs", target: "185 lbs", streak: 12 };
const TARGETS = { kcal: 2200, protein: 165, carbs: 220, fat: 73, water: 8 };
const CONSUMED = { kcal: 1380, protein: 98, carbs: 145, fat: 48, water: 5 };
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TODAY = 3;

const MEALS = [
  { id:1, type:"Breakfast", name:"Egg & Avocado Toast", kcal:520, protein:28, carbs:42, fat:18, time:"8:30 AM", prep:"10 min", difficulty:"Easy", done:true, emoji:"🍳", confidence:96 },
  { id:2, type:"Lunch", name:"Grilled Chicken Bowl", kcal:680, protein:52, carbs:68, fat:18, time:"12:30 PM", prep:"20 min", difficulty:"Easy", done:true, emoji:"🥗", confidence:94 },
  { id:3, type:"Snack", name:"Greek Yogurt & Berries", kcal:180, protein:18, carbs:22, fat:4, time:"3:30 PM", prep:"2 min", difficulty:"Easy", done:true, emoji:"🫐", confidence:92 },
  { id:4, type:"Dinner", name:"Salmon & Quinoa", kcal:680, protein:48, carbs:52, fat:22, time:"7:00 PM", prep:"30 min", difficulty:"Medium", done:false, emoji:"🐟", confidence:98 },
];

const GROCERY = {
  "Proteins": [{ id:1, name:"Chicken Breast", qty:"2 lbs", done:true }, { id:2, name:"Salmon Fillet", qty:"12 oz", done:false }, { id:3, name:"Greek Yogurt", qty:"32 oz", done:true }, { id:4, name:"Eggs", qty:"12 count", done:false }],
  "Vegetables": [{ id:5, name:"Broccoli", qty:"1 head", done:true }, { id:6, name:"Baby Spinach", qty:"5 oz", done:false }, { id:7, name:"Bell Peppers", qty:"3 mixed", done:false }],
  "Grains": [{ id:8, name:"Quinoa", qty:"1 lb bag", done:false }, { id:9, name:"Brown Rice", qty:"2 lbs", done:true }],
  "Fruits": [{ id:10, name:"Mixed Berries", qty:"12 oz frozen", done:false }, { id:11, name:"Avocado", qty:"2 ripe", done:false }, { id:12, name:"Banana", qty:"1 bunch", done:true }],
  "Dairy": [{ id:13, name:"Cottage Cheese", qty:"16 oz", done:false }, { id:14, name:"Almond Milk", qty:"½ gallon", done:false }],
};

const DIETARY_OPTS = ["Vegan","Vegetarian","Gluten-Free","Dairy-Free","Keto","Low-Carb","High-Protein","Nut-Free"];
const GOAL_OPTS = ["Fat Loss","Muscle Gain","Maintenance","High Protein","Low Carb","Balanced"];
const ACHIEVEMENTS = [
  { emoji:"🔥", label:"12-Day Streak" }, { emoji:"💪", label:"Protein Goal x7" },
  { emoji:"🥗", label:"Meal Planner" }, { emoji:"💧", label:"Hydration Pro" },
];

// ── API Key Setup Banner ──────────────────────────────────
function APIKeyBanner({ apiKey, setApiKey }) {
  const [val, setVal] = useState("");
  const [show, setShow] = useState(false);
  if (apiKey) return (
    <div style={{ background: T.mintLight, borderBottom: `1px solid ${T.mint}`, padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 12, color: T.mintDark, fontWeight: 600 }}>✓ Anthropic API key connected</span>
      <button onClick={() => { setApiKey(""); setShow(false); }} style={{ fontSize: 11, color: T.g4, background: "none", border: "none", cursor: "pointer" }}>Clear</button>
    </div>
  );
  return (
    <div style={{ background: "#FEF9EC", borderBottom: "1px solid #FFD966", padding: "10px 16px" }}>
      {!show ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#92400E", fontWeight: 500 }}>⚠️ Add your Anthropic API key to use AI features</span>
          <button onClick={() => setShow(true)} style={{ fontSize: 12, fontWeight: 700, color: "#1A8C5F", background: "none", border: "none", cursor: "pointer" }}>Add Key →</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={val} onChange={e => setVal(e.target.value)}
            placeholder="sk-ant-api..."
            type="password"
            style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: `1.5px solid ${T.g2}`, fontSize: 13, outline: "none" }}
          />
          <button onClick={() => { if (val.startsWith("sk-ant")) { setApiKey(val); setShow(false); } }}
            style={{ padding: "8px 14px", borderRadius: 10, background: T.mintDark, color: T.white, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save</button>
          <button onClick={() => setShow(false)} style={{ padding: "8px 10px", borderRadius: 10, background: T.g1, border: "none", fontSize: 13, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </div>
  );
}

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

function Btn({ label, onPress, primary, small, style: st }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button onClick={onPress}
      onMouseDown={() => setPressed(true)} onMouseUp={() => setPressed(false)} onMouseLeave={() => setPressed(false)}
      style={{
        padding: small ? "8px 16px" : "14px 24px", borderRadius: 14, border: "none",
        background: primary ? T.mintDark : T.g1, color: primary ? T.white : T.g6,
        fontSize: small ? 13 : 15, fontWeight: 700, cursor: "pointer",
        transform: pressed ? "scale(0.97)" : "scale(1)", transition: "transform 0.1s",
        letterSpacing: 0.2, ...st
      }}>{label}
    </button>
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

// ── Meal Card ────────────────────────────────────────────
function MealCard({ meal }) {
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
          <Btn label="View Recipe" small onPress={() => setOpen(!open)} style={{ flex: 1 }} />
          <Btn label="Swap" small onPress={() => {}} style={{ flex: 1 }} />
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

// ── AI Recipe Card ────────────────────────────────────────
function AICard({ recipe, index }) {
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
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, background: T.mintDark, color: T.white, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i+1}</span>
                <span style={{ fontSize: 13, color: T.g6, lineHeight: 1.6 }}>{s}</span>
              </li>
            ))}
          </ol>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Btn label="Cook Now" primary onPress={() => {}} style={{ flex: 1 }} />
          <Btn label="Save" onPress={() => {}} style={{ flex: 1 }} />
        </div>
      </div>
    </div>
  );
}

// ── Screens ──────────────────────────────────────────────
function HomeScreen() {
  const rem = TARGETS.kcal - CONSUMED.kcal;
  return (
    <div style={{ padding: "16px 16px 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, color: T.g4, fontWeight: 500 }}>Good afternoon,</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: T.black, letterSpacing: -0.5 }}>{USER.name} 👋</div>
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 99, background: `linear-gradient(135deg, ${T.mintDark}, ${T.mint})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💪</div>
      </div>

      <div style={{ ...card, background: "linear-gradient(140deg, #0E2A1C 0%, #1A5C3A 60%, #1E8C5F 100%)", marginBottom: 14, padding: "22px 20px" }}>
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
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>💧 Water</span>
            <span style={{ fontSize: 12, color: T.mint, fontWeight: 700 }}>{CONSUMED.water}/{TARGETS.water} glasses</span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {Array(TARGETS.water).fill(0).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 8, borderRadius: 99, background: i < CONSUMED.water ? T.water : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...card, background: T.mintLight, border: `1.5px solid ${T.mint}`, marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>🌿</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.mintDark, marginBottom: 4 }}>AI Meal Planner</div>
          <div style={{ fontSize: 13, color: T.g5, lineHeight: 1.5, marginBottom: 12 }}>Based on your goals and available ingredients, we've created today's meal plan.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn label="Generate New Plan" primary small onPress={() => {}} style={{ fontSize: 12 }} />
            <Btn label="Customize" small onPress={() => {}} style={{ fontSize: 12 }} />
          </div>
        </div>
      </div>

      <div style={{ fontSize: 18, fontWeight: 700, color: T.black, marginBottom: 12 }}>Today's Meals</div>
      {MEALS.map(m => <MealCard key={m.id} meal={m} />)}
    </div>
  );
}

function PlanScreen() {
  const [day, setDay] = useState(TODAY);
  const [expanded, setExpanded] = useState("Dinner");
  const types = ["Breakfast","Lunch","Dinner","Snack"];
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.black, marginBottom: 16, letterSpacing: -0.3 }}>Weekly Plan</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {DAYS.map((d, i) => (
          <button key={d} onClick={() => setDay(i)} style={{
            flexShrink: 0, width: 48, padding: "10px 0", borderRadius: 14, border: "none", cursor: "pointer",
            background: day === i ? T.mintDark : i === TODAY ? T.mintLight : T.white,
            boxShadow: day === i ? shadow.md : shadow.sm, transition: "all 0.2s",
          }}>
            <div style={{ fontSize: 11, color: day === i ? T.mint : T.g4, fontWeight: 600, marginBottom: 4 }}>{d}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: day === i ? T.white : T.black }}>{14 + i}</div>
            {i === TODAY && day !== i && <div style={{ width: 5, height: 5, borderRadius: 99, background: T.mintDark, margin: "4px auto 0" }} />}
          </button>
        ))}
      </div>
      {types.map(type => {
        const meal = MEALS.find(m => m.type === type) || MEALS[0];
        const isOpen = expanded === type;
        return (
          <div key={type} style={{ marginBottom: 10 }}>
            <button onClick={() => setExpanded(isOpen ? null : type)} style={{
              width: "100%", ...card, padding: "14px 18px", border: "none", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>{meal.emoji}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 11, color: T.g4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{type}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.black }}>{day === TODAY ? meal.name : "Not planned"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {day === TODAY && <span style={{ fontSize: 13, fontWeight: 700, color: T.g4 }}>{meal.kcal} kcal</span>}
                <span style={{ fontSize: 12, color: T.g4, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}>▼</span>
              </div>
            </button>
            {isOpen && day === TODAY && <div style={{ marginTop: 6 }}><MealCard meal={meal} /></div>}
            {isOpen && day !== TODAY && (
              <div style={{ ...card, marginTop: 6, padding: "20px", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✨</div>
                <div style={{ fontSize: 14, color: T.g4 }}>No meal planned. Use the AI tab to generate one.</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AIScreen({ apiKey }) {
  const [step, setStep] = useState("input");
  const [ingredients, setIngredients] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [prefs, setPrefs] = useState([]);
  const [goal, setGoal] = useState("Muscle Gain");
  const [loading, setLoading] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const addIng = val => {
    const t = val.trim().toLowerCase();
    if (t && !ingredients.includes(t)) setIngredients(p => [...p, t]);
    setInputVal("");
  };
  const handleKey = e => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addIng(inputVal); }
    else if (e.key === "Backspace" && inputVal === "" && ingredients.length > 0) setIngredients(p => p.slice(0, -1));
  };
  const togglePref = id => setPrefs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const generate = async () => {
    if (!ingredients.length || !apiKey) return;
    setLoading(true); setError(null); setRecipes([]);
    const prefStr = prefs.length ? `Dietary requirements (strictly follow): ${prefs.join(", ")}.` : "";
    const prompt = `You are a professional nutritionist and chef. Generate exactly 3 different recipes using primarily: ${ingredients.join(", ")}.
Goal: ${goal}. ${prefStr}
You may add 1-2 basic pantry staples per recipe (salt, oil, common spices). Do NOT add major new ingredients.
Respond ONLY with valid JSON — no markdown, no explanation:
{"recipes":[{"name":"","difficulty":"Easy","prepTime":"","servings":2,"macros":{"calories":0,"protein":0,"carbs":0,"fat":0},"steps":[""]}]}
Rules: difficulty is Easy/Medium/Hard; macros are realistic per-serving integers; 4-7 steps each; 3 recipes meaningfully different in cuisine or method.`;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const text = data.content.map(b => b.text || "").join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setRecipes(parsed.recipes || []);
      setStep("results");
    } catch (err) {
      setError(err.message || "Couldn't generate recipes. Check your API key and try again.");
    } finally {
      setLoading(false);
    }
  };

  if (step === "results") return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={() => setStep("input")} style={{ width: 36, height: 36, borderRadius: 99, background: T.g1, border: "none", cursor: "pointer", fontSize: 18 }}>←</button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.black }}>Your Recipes</div>
          <div style={{ fontSize: 12, color: T.g4 }}>{ingredients.slice(0, 3).join(", ")}{ingredients.length > 3 ? ` +${ingredients.length-3} more` : ""}</div>
        </div>
      </div>
      {recipes.map((r, i) => <AICard key={i} recipe={r} index={i} />)}
    </div>
  );

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.mintDark, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>AI Meal Generator</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.black, letterSpacing: -0.4 }}>What's in your kitchen?</div>
      </div>

      {!apiKey && (
        <div style={{ background: "#FEF9EC", border: "1px solid #FFD966", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>⚠️ Add your Anthropic API key (top of screen) to generate AI recipes</div>
        </div>
      )}

      <div style={{ ...card, padding: "16px", marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
          Your Ingredients <span style={{ color: T.g4, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>— Enter to add</span>
        </div>
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
            placeholder={!ingredients.length ? "e.g. chicken, broccoli, garlic..." : ""}
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, color: T.black, minWidth: 160, flex: 1, padding: "4px 0" }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          {["chicken","rice","broccoli","eggs","avocado"].filter(i => !ingredients.includes(i)).map(s => (
            <button key={s} onClick={() => setIngredients(p => [...p, s])} style={{ padding: "5px 12px", borderRadius: 99, border: `1.5px dashed ${T.g3}`, background: "transparent", color: T.g4, fontSize: 12, cursor: "pointer", fontWeight: 500 }}>+ {s}</button>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 14, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Nutrition Goal</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {GOAL_OPTS.map(g => (
            <button key={g} onClick={() => setGoal(g)} style={{ padding: "8px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: goal === g ? T.mintDark : T.g1, color: goal === g ? T.white : T.g5, transition: "all 0.15s" }}>{g}</button>
          ))}
        </div>
      </div>

      <div style={{ ...card, marginBottom: 20, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Dietary Preferences</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {DIETARY_OPTS.map(p => {
            const active = prefs.includes(p);
            return (
              <button key={p} onClick={() => togglePref(p)} style={{ padding: "7px 14px", borderRadius: 99, cursor: "pointer", fontSize: 13, fontWeight: 500, border: active ? `2px solid ${T.mintDark}` : `1.5px solid ${T.g2}`, background: active ? T.mintLight : T.white, color: active ? T.mintDark : T.g4, transition: "all 0.15s" }}>{active ? "✓ " : ""}{p}</button>
            );
          })}
        </div>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "12px 16px", marginBottom: 14, color: T.error, fontSize: 13 }}>⚠️ {error}</div>}

      <Btn
        label={loading ? "⏳ Generating..." : !apiKey ? "Add API key to generate" : ingredients.length ? `✨ Generate 3 Recipes (${ingredients.length} ingredients)` : "Add ingredients to generate"}
        primary onPress={!loading && ingredients.length && apiKey ? generate : () => {}}
        style={{ width: "100%", opacity: (!ingredients.length || !apiKey) ? 0.5 : 1 }}
      />

      {loading && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12, display: "inline-block", animation: "spin 2s linear infinite" }}>🌀</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.mintDark, marginBottom: 4 }}>Creating your recipes...</div>
          <div style={{ fontSize: 13, color: T.g4 }}>Analyzing nutrition & personalizing for {goal}</div>
        </div>
      )}
    </div>
  );
}

function GroceryScreen() {
  const [checked, setChecked] = useState(() => Object.values(GROCERY).flat().reduce((a, i) => ({ ...a, [i.id]: i.done }), {}));
  const [open, setOpen] = useState(Object.keys(GROCERY).reduce((a, k) => ({ ...a, [k]: true }), {}));
  const total = Object.values(GROCERY).flat().length;
  const done = Object.values(checked).filter(Boolean).length;
  const catEmoji = { Proteins:"🥩", Vegetables:"🥦", Grains:"🌾", Fruits:"🍎", Dairy:"🥛" };
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: T.black, marginBottom: 4, letterSpacing: -0.3 }}>Grocery List</div>
      <div style={{ fontSize: 14, color: T.g4, marginBottom: 16 }}>{done} of {total} items checked</div>
      <div style={{ height: 6, background: T.g2, borderRadius: 99, marginBottom: 20, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(done/total)*100}%`, background: T.mintDark, borderRadius: 99, transition: "width 0.4s ease" }} />
      </div>
      {Object.entries(GROCERY).map(([cat, items]) => {
        const catDone = items.filter(i => checked[i.id]).length;
        return (
          <div key={cat} style={{ marginBottom: 10 }}>
            <button onClick={() => setOpen(p => ({ ...p, [cat]: !p[cat] }))} style={{ ...card, width: "100%", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontSize: 20 }}>{catEmoji[cat] || "🛒"}</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.black }}>{cat}</div>
                  <div style={{ fontSize: 12, color: T.g4 }}>{catDone}/{items.length} items</div>
                </div>
              </div>
              <span style={{ fontSize: 11, transform: open[cat] ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", color: T.g4 }}>▼</span>
            </button>
            {open[cat] && (
              <div style={{ ...card, marginTop: 4, padding: "6px 18px" }}>
                {items.map(item => (
                  <div key={item.id} onClick={() => setChecked(p => ({ ...p, [item.id]: !p[item.id] }))}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${T.g1}`, cursor: "pointer" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 8, border: `2px solid ${checked[item.id] ? T.mintDark : T.g3}`, background: checked[item.id] ? T.mintDark : T.white, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                      {checked[item.id] && <span style={{ color: T.white, fontSize: 13, fontWeight: 700 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: checked[item.id] ? T.g4 : T.black, textDecoration: checked[item.id] ? "line-through" : "none" }}>{item.name}</div>
                      <div style={{ fontSize: 12, color: T.g4 }}>{item.qty}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProfileScreen() {
  const statRows = [
    { icon:"⚖️", label:"Current Weight", value: USER.weight },
    { icon:"🎯", label:"Target Weight", value: USER.target },
    { icon:"🔥", label:"Daily Calories", value:`${TARGETS.kcal} kcal` },
    { icon:"💪", label:"Daily Protein", value:`${TARGETS.protein}g` },
    { icon:"📅", label:"Current Streak", value:`${USER.streak} days` },
  ];
  const settings = ["Notification Preferences","Dietary Restrictions","Connected Apps","Privacy Settings","Help & Support"];
  return (
    <div style={{ padding: "16px" }}>
      <div style={{ ...card, background: "linear-gradient(135deg, #0E2A1C 0%, #1A8C5F 100%)", padding: "24px 20px", marginBottom: 14, textAlign: "center" }}>
        <div style={{ width: 72, height: 72, borderRadius: 99, background: `linear-gradient(135deg, ${T.mint}, ${T.mintDark})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto 12px" }}>💪</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T.white, marginBottom: 4 }}>{USER.name}</div>
        <div style={{ display: "inline-block", background: "rgba(168,245,211,0.2)", borderRadius: 99, padding: "5px 14px" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.mint }}>🎯 {USER.goal}</span>
        </div>
      </div>
      <div style={{ ...card, marginBottom: 14, padding: "6px 18px" }}>
        {statRows.map((s, i) => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: i < statRows.length - 1 ? `1px solid ${T.g1}` : "none" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <span style={{ fontSize: 15, color: T.g5, fontWeight: 500 }}>{s.label}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.black }}>{s.value}</span>
          </div>
        ))}
      </div>
      <div style={{ ...card, marginBottom: 14, padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.black, marginBottom: 14 }}>Macro Split</div>
        <MacroBar label="Protein" value={TARGETS.protein} max={TARGETS.protein + TARGETS.carbs + TARGETS.fat} color={T.protein} />
        <MacroBar label="Carbohydrates" value={TARGETS.carbs} max={TARGETS.protein + TARGETS.carbs + TARGETS.fat} color={T.carbs} />
        <MacroBar label="Fat" value={TARGETS.fat} max={TARGETS.protein + TARGETS.carbs + TARGETS.fat} color={T.fat} />
      </div>
      <div style={{ ...card, marginBottom: 14, padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.black, marginBottom: 12 }}>Achievements</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {ACHIEVEMENTS.map(a => (
            <div key={a.label} style={{ flex: "1 1 40%", background: T.mintLight, borderRadius: 14, padding: "12px", textAlign: "center" }}>
              <div style={{ fontSize: 26, marginBottom: 6 }}>{a.emoji}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.mintDark }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ ...card, marginBottom: 14, padding: "6px 18px" }}>
        {settings.map((s, i) => (
          <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: i < settings.length - 1 ? `1px solid ${T.g1}` : "none", cursor: "pointer" }}>
            <span style={{ fontSize: 15, color: T.black, fontWeight: 500 }}>{s}</span>
            <span style={{ color: T.g3, fontSize: 18 }}>›</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <div style={{ fontSize: 12, color: T.g4 }}>NutriCook AI · v2.0 · Built by {USER.name}</div>
        <div style={{ fontSize: 11, color: T.g3, marginTop: 2 }}>Powered by Claude AI (Anthropic)</div>
      </div>
    </div>
  );
}

// ── Bottom Nav ───────────────────────────────────────────
const NAV = [
  { id:"home", icon:"⊙", label:"Home" },
  { id:"plan", icon:"📅", label:"Plan" },
  { id:"ai", icon:"🌿", label:"", fab:true },
  { id:"grocery", icon:"🛒", label:"Grocery" },
  { id:"profile", icon:"👤", label:"Profile" },
];

function BottomNav({ tab, setTab }) {
  return (
    <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"rgba(255,255,255,0.95)", backdropFilter:"blur(20px)", borderTop:`1px solid ${T.g2}`, paddingBottom:8 }}>
      <div style={{ display:"flex", alignItems:"flex-end", height:64 }}>
        {NAV.map(n => n.fab ? (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex:1, display:"flex", justifyContent:"center", alignItems:"center", border:"none", background:"transparent", cursor:"pointer", paddingBottom:10 }}>
            <div style={{ width:54, height:54, borderRadius:99, marginTop:-18, background:tab===n.id ? T.mintDark : `linear-gradient(135deg, ${T.mintDark}, ${T.mintMid})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, boxShadow:`0 4px 16px rgba(30,140,95,0.4)`, transition:"transform 0.15s", transform:tab===n.id?"scale(1.08)":"scale(1)" }}>🌿</div>
          </button>
        ) : (
          <button key={n.id} onClick={() => setTab(n.id)} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", border:"none", background:"transparent", cursor:"pointer", height:"100%", gap:3, paddingTop:6 }}>
            <span style={{ fontSize:20, filter:tab===n.id?"none":"grayscale(1) opacity(0.5)" }}>{n.icon}</span>
            <span style={{ fontSize:10, fontWeight:600, color:tab===n.id?T.mintDark:T.g4 }}>{n.label}</span>
            {tab===n.id && <div style={{ width:4, height:4, borderRadius:99, background:T.mintDark }} />}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── App ──────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("home");
  const [apiKey, setApiKey] = useState("");
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [tab]);

  return (
    <>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; background: #1C1C1E; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #C7C7CC; border-radius: 99px; }
      `}</style>

      <div style={{ maxWidth: 430, margin: "0 auto", height: "100vh", background: T.bg, position: "relative", overflow: "hidden", fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif" }}>
        {/* Status bar */}
        <div style={{ background: T.white, padding: "12px 20px 8px", display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: T.black, borderBottom: `1px solid ${T.g1}` }}>
          <span>9:41</span>
          <span style={{ fontSize: 11, color: T.mintDark, fontWeight: 700, letterSpacing: 0.5 }}>NUTRICOOK AI</span>
          <span>● ● ▮</span>
        </div>

        {/* API Key Banner */}
        <APIKeyBanner apiKey={apiKey} setApiKey={setApiKey} />

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ height: "calc(100vh - 36px - 72px - (apiKey ? 36px : 40px))", overflowY: "auto", overflowX: "hidden" }}>
          {tab === "home"    && <HomeScreen />}
          {tab === "plan"    && <PlanScreen />}
          {tab === "ai"      && <AIScreen apiKey={apiKey} />}
          {tab === "grocery" && <GroceryScreen />}
          {tab === "profile" && <ProfileScreen />}
        </div>

        <BottomNav tab={tab} setTab={setTab} />
      </div>
    </>
  );
}

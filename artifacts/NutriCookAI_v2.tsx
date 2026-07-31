import { useState, useEffect, useRef } from "react";
import { hasSupabase, supabase } from "../src/lib/supabase.js";
import { isProActive, computeStreak } from "../src/lib/quota.js";
import * as db from "../src/lib/db.js";

// ── Tokens (v3.0 — warm neutrals + a single forest-green accent) ─────────
// Values are CSS custom properties so the whole tree recolors from one
// `data-theme` flip on <html>. `onDark` (text on the fixed forest gradient)
// stays light in both themes; `onAccent` (text on the flat accent fill)
// flips because the accent itself lifts to sage on dark.
const T = {
  mint: "var(--t-mint)", mintMid: "var(--t-mintMid)", mintDark: "var(--t-mintDark)",
  mintLight: "var(--t-mintLight)", deep: "#1E3D2E",
  onDark: "#F7F6F3", onAccent: "var(--t-onAccent)",
  bg: "var(--t-bg)", white: "var(--t-white)", black: "var(--t-black)",
  g1: "var(--t-g1)", g2: "var(--t-g2)", g3: "var(--t-g3)", g4: "var(--t-g4)", g5: "var(--t-g5)", g6: "var(--t-g6)",
  success: "var(--t-success)", warn: "var(--t-warn)", error: "var(--t-error)", blue: "var(--t-blue)",
  protein: "var(--t-protein)", carbs: "var(--t-carbs)", fat: "var(--t-fat)", water: "var(--t-water)",
};
const FOREST = `linear-gradient(160deg, #2F5D45 0%, #1E3D2E 100%)`;
const THEME_CSS = `
:root{
  --t-mint:#A9CBBA;--t-mintMid:#3F7A5A;--t-mintDark:#2F5D45;--t-mintLight:#E9EFEA;--t-onAccent:#F7F6F3;
  --t-bg:#F7F6F3;--t-white:#FFFFFF;--t-black:#1B1A17;
  --t-g1:#F2F1EC;--t-g2:#E7E3DA;--t-g3:#D5D0C5;--t-g4:#9C978C;--t-g5:#6E6A61;--t-g6:#3D3A34;
  --t-success:#2F5D45;--t-warn:#C8763C;--t-error:#B23B2E;--t-blue:#4A7080;
  --t-protein:#3F7A5A;--t-carbs:#C8763C;--t-fat:#B9A05B;--t-water:#6E8FA0;
  --t-cardBorder:transparent;--t-page:#E7E4DD;--t-scroll:#D5D0C5;
}
:root[data-theme="dark"]{
  --t-mint:#A9CBBA;--t-mintMid:#5E9B7D;--t-mintDark:#86BFA3;--t-mintLight:rgba(134,191,163,0.15);--t-onAccent:#12251B;
  --t-bg:#131311;--t-white:#1C1C19;--t-black:#F3F1EB;
  --t-g1:#24241F;--t-g2:rgba(255,255,255,0.09);--t-g3:rgba(255,255,255,0.22);--t-g4:#6F6C63;--t-g5:#A29E93;--t-g6:#C7C2B7;
  --t-success:#86BFA3;--t-warn:#DE9B60;--t-error:#E5988C;--t-blue:#8FB0C2;
  --t-protein:#86BFA3;--t-carbs:#DE9B60;--t-fat:#CBB273;--t-water:#8FB0C2;
  --t-cardBorder:rgba(255,255,255,0.07);--t-page:#0F0F0D;--t-scroll:rgba(255,255,255,0.18);
}
`;
const getInitialTheme = () =>
  (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
const shadow = {
  sm: "0 1px 2px rgba(27,26,23,0.05)",
  md: "0 1px 2px rgba(27,26,23,0.04), 0 14px 30px -22px rgba(27,26,23,0.22)",
  lg: "0 1px 2px rgba(27,26,23,0.05), 0 24px 48px -24px rgba(27,26,23,0.30)",
};
const card = { background: T.white, borderRadius: 24, padding: "20px", boxShadow: shadow.md, border: "1px solid var(--t-cardBorder)" };

// ── Lucide line icons (1.7 stroke, currentColor) ─────────
const ICONS = {
  home: <><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></>,
  calendar: <><path d="M8 2v4" /><path d="M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18" /></>,
  basket: <><path d="m15 11-1 9" /><path d="m19 11-4-7" /><path d="M2 11h20" /><path d="m3.5 11 1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4" /><path d="m5 11 4-7" /><path d="m9 11 1 9" /></>,
  user: <><circle cx="12" cy="8" r="5" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  sparkles: <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />,
  camera: <><path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" /><circle cx="12" cy="13" r="3" /></>,
  search: <><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  chevronRight: <path d="m9 18 6-6-6-6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  arrowLeft: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  flame: <path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4" />,
  droplet: <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
  trendUp: <><path d="M16 7h6v6" /><path d="m22 7-8.5 8.5-5-5L2 17" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
  heart: <path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5" />,
  bookmark: <path d="M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z" />,
  settings: <><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /><circle cx="12" cy="12" r="3" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  bulb: <><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></>,
  leaf: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></>,
  infinity: <path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8" />,
  utensils: <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  shield: <><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  bell: <><path d="M10.268 21a2 2 0 0 0 3.464 0" /><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" /></>,
  drumstick: <><path d="M16.4 13.7A6.5 6.5 0 1 0 6.28 6.6c-1.1 3.13-.78 3.9-3.18 6.08A3 3 0 0 0 5 18c4 0 8.4-1.8 11.4-4.3" /><path d="m18.5 6 2.19 4.5a6.48 6.48 0 0 1-2.29 7.2C15.4 20.2 11 22 7 22a3 3 0 0 1-2.68-1.66L2.4 16.5" /><circle cx="12.5" cy="8.5" r="2.5" /></>,
  salad: <><path d="M7 21h10" /><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z" /><path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1" /><path d="m13 12 4-4" /></>,
  wheat: <><path d="M2 22 16 8" /><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" /><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" /><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" /></>,
  apple: <><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" /><path d="M10 2c1 .5 2 2 2 5" /></>,
  milk: <><path d="M8 2h8" /><path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2" /><path d="M7 15a6.47 6.47 0 0 1 5 0 6.472 6.472 0 0 0 5 0" /></>,
  moon: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
};
function Icon({ name, size = 20, color = "currentColor", sw = 1.7, style }) {
  // Color is applied via the CSS `color` property + `stroke="currentColor"` so
  // CSS-variable tokens resolve reliably inside SVG (var() in a bare stroke
  // attribute is not universally supported).
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", flexShrink: 0, color, ...style }}>
      {ICONS[name]}
    </svg>
  );
}

// Typographic monogram dish tile — tint keyed to the meal slot (no photos, no emoji).
const SLOT_TINT = {
  Breakfast: ["#F1EAD9", "#A8853F"], Lunch: ["#E4EDE6", "#3F7A5A"],
  Dinner: ["#E2EAEC", "#4A7080"], Snack: ["#F0E7E2", "#A4735E"],
};
function DishTile({ name, slot, size = 56, radius = 15 }) {
  const [bg, fg] = SLOT_TINT[slot] || SLOT_TINT.Lunch;
  const letter = String(name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div style={{ width: size, height: size, borderRadius: radius, background: bg, color: fg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: Math.round(size * 0.4), fontWeight: 600, letterSpacing: -0.5, fontFamily: "-apple-system,'SF Pro Display',Inter,system-ui,sans-serif" }}>{letter}</div>
  );
}

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
  { icon:"flame", tint:"#F1EAD9", fg:"#A8853F", label:"12-Day Streak" },
  { icon:"target", tint:"#E9EFEA", fg:"#2F5D45", label:"Protein Goal x7" },
  { icon:"salad", tint:"#E4EDE6", fg:"#3F7A5A", label:"Meal Planner" },
  { icon:"droplet", tint:"#E2EAEC", fg:"#4A7080", label:"Hydration Pro" },
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
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke} style={{ stroke: "rgba(255,255,255,0.16)" }} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          style={{ stroke: color, transition: "stroke-dashoffset 1.2s cubic-bezier(.22,.68,0,1.2)" }}
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
        padding: small ? "8px 16px" : "14px 24px", borderRadius: 16, border: "none",
        background: primary ? T.mintDark : T.g1, color: primary ? T.onAccent : T.g6,
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
      {/* Accent bar by state */}
      <div style={{ height: 4, background: meal.done ? T.mintDark : T.g2 }} />
      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          {/* Monogram thumbnail */}
          <DishTile name={meal.name} slot={meal.type} size={56} radius={16} />
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
            <button onClick={() => (onFav ? onFav(meal) : setLocalFav(f => !f))} style={{ width: 40, height: 40, borderRadius: 14, border: `1px solid ${fav ? T.mintDark : T.g2}`, background: fav ? T.mintLight : T.white, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: fav ? T.mintDark : T.g5, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}><Icon name="heart" size={17} color={fav ? T.mintDark : T.g5} sw={fav ? 2.2 : 1.7} /></button>
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
      <div style={{ background: FOREST, padding: "18px 18px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <Pill text={`Option ${index + 1}`} color={T.mint} bg="rgba(169,203,186,0.18)" />
          <Pill text={recipe.difficulty} color={T.onAccent} bg={diffColor} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.onDark, lineHeight: 1.25, marginBottom: 8, letterSpacing: -0.3 }}>{recipe.name}</div>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "rgba(255,255,255,0.6)", alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Icon name="clock" size={13} color="rgba(255,255,255,0.6)" />{recipe.prepTime}</span>
          <span>{recipe.servings} servings</span>
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
          width: "100%", background: open ? T.mintLight : T.g1, border: `1px solid ${open ? T.mintDark : T.g2}`,
          borderRadius: 14, padding: "11px 14px", cursor: "pointer", display: "flex",
          justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, color: T.mintDark,
        }}>
          <span>{open ? "Hide" : "Show"} steps ({recipe.steps.length})</span>
          <span style={{ display: "flex", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}><Icon name="chevronDown" size={16} color={T.mintDark} /></span>
        </button>
        {open && (
          <ol style={{ margin: "12px 0 0", padding: 0, animation: "popIn .25s ease both" }}>
            {recipe.steps.map((s, i) => (
              <li key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, background: T.mintDark, color: T.onAccent, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i+1}</span>
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
          <div style={{ fontSize: 11, color: T.mintDark, fontWeight: 600, marginTop: 8, textAlign: "center" }}>Saved to Want to Try · ingredients added to Basket</div>
        )}
        {/* AI Remix agent */}
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.g1}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: T.g4, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>
            <Icon name="sparkles" size={13} color={T.mintDark} sw={1.6} />
            {remixing ? "Remixing this recipe…" : "Remix with AI"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, opacity: remixing ? 0.5 : 1 }}>
            {[["Spicier", "Make it noticeably spicier"], ["More protein", "Increase the protein significantly"], ["Fewer calories", "Reduce the calories while keeping it satisfying"], ["×2 servings", "Double the servings and scale ingredients"]].map(([label, instruction]) => (
              <button key={label} onClick={() => remix(instruction)} disabled={remixing} style={{
                padding: "7px 13px", borderRadius: 99, border: `1px solid ${T.g2}`, background: T.white,
                color: T.g5, fontSize: 12, fontWeight: 500, cursor: "pointer",
              }}>{label}</button>
            ))}
            <button onClick={() => setSwapMode(s => !s)} disabled={remixing} style={{
              padding: "7px 13px", borderRadius: 99, border: `1px solid ${swapMode ? T.mintDark : T.g2}`, background: swapMode ? T.mintLight : T.white,
              color: swapMode ? T.mintDark : T.g5, fontSize: 12, fontWeight: 500, cursor: "pointer",
            }}>Swap ingredient</button>
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
          {remixErr && <div style={{ fontSize: 12, color: T.error, marginTop: 8 }}>{remixErr}</div>}
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

function HomeScreen({ setTab, favorites, toggleFavorite, userName = USER.name, targets = TARGETS, live = false, mealLogs = [], initialWater, onWater, onMarkMeal }) {
  // In live mode, "today's progress" sums the meals the user has marked eaten
  // today (seeded from meal_logs, updated live as they tap). Demo mode keeps the
  // static v2.5 figures.
  const todayISO = new Date().toISOString().slice(0, 10);
  const [eaten, setEaten] = useState(() => new Set(
    (mealLogs || []).filter(m => String(m.eaten_on).slice(0, 10) === todayISO && m.done !== false).map(m => m.slot)
  ));
  const markEaten = meal => {
    const on = !eaten.has(meal.type);
    setEaten(prev => { const n = new Set(prev); on ? n.add(meal.type) : n.delete(meal.type); return n; });
    onMarkMeal?.(meal, on);
  };
  const consumed = live
    ? MEALS.filter(m => eaten.has(m.type)).reduce((a, m) => ({ kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })
    : CONSUMED;
  const [water, setWater] = useState(initialWater ?? CONSUMED.water);
  const changeWater = n => { setWater(n); onWater?.(n); };
  const rem = targets.kcal - consumed.kcal;

  return (
    <div style={{ padding: "16px 16px 8px" }}>
      {/* Greeting */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 12, color: T.g4, fontWeight: 500, letterSpacing: 0.6, textTransform: "uppercase" }}>{NOW.getHours() < 12 ? "Good morning" : NOW.getHours() < 18 ? "Good afternoon" : "Good evening"}</div>
          <div style={{ fontSize: 27, fontWeight: 600, color: T.black, letterSpacing: -0.7, marginTop: 4 }}>{userName}</div>
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 99, background: T.mintLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, color: T.mintDark }}>{String(userName).trim().charAt(0).toUpperCase() || "C"}</div>
      </div>

      {/* Progress Card */}
      <div style={{ ...card, background: FOREST, marginBottom: 14, padding: "22px 20px", animation: "slideUp .4s cubic-bezier(.22,.68,0,1) both" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>Today's progress</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Ring pct={consumed.kcal / targets.kcal} color={T.mint} size={120} stroke={10}>
            <div style={{ fontSize: 24, fontWeight: 800, color: T.onDark, lineHeight: 1 }}>{rem}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>kcal left</div>
          </Ring>
          <div style={{ flex: 1, paddingLeft: 24 }}>
            <MacroRow label="Protein" value={consumed.protein} target={targets.protein} color={T.protein} />
            <MacroRow label="Carbs" value={consumed.carbs} target={targets.carbs} color={T.carbs} />
            <MacroRow label="Fat" value={consumed.fat} target={targets.fat} color={T.fat} />
          </div>
        </div>
        {/* Water */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}><Icon name="droplet" size={14} color={T.water} />Water</span>
            <span style={{ fontSize: 12, color: T.mint, fontWeight: 700 }}>{water}/{targets.water} glasses</span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            {Array(targets.water).fill(0).map((_, i) => (
              <div key={i} onClick={() => changeWater(i + 1 === water ? i : i + 1)} title="Tap to log water"
                style={{ flex: 1, height: 8, borderRadius: 99, cursor: "pointer", background: i < water ? T.water : "rgba(255,255,255,0.15)", transition: "background 0.2s" }} />
            ))}
          </div>
        </div>
      </div>

      {/* AI Banner */}
      <div style={{ ...card, background: T.mintLight, border: `1px solid rgba(47,93,69,0.14)`, marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 18px", animation: "slideUp .4s cubic-bezier(.22,.68,0,1) both", animationDelay: "0.06s" }}>
        <div style={{ width: 40, height: 40, borderRadius: 13, background: "rgba(47,93,69,0.10)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="leaf" size={20} color={T.mintDark} sw={1.6} /></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.mintDark, marginBottom: 4 }}>AI meal planner</div>
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
          <MealCard meal={live ? { ...m, done: eaten.has(m.type) } : m} isFav={favorites.some(f => f.name === m.name)} onFav={toggleFavorite} />
          {live && (
            <button onClick={() => markEaten(m)} style={{
              width: "100%", marginTop: -6, marginBottom: 12, padding: "9px", borderRadius: 12, cursor: "pointer",
              border: `1.5px solid ${eaten.has(m.type) ? T.mintDark : T.g2}`, background: eaten.has(m.type) ? T.mintLight : T.white,
              color: eaten.has(m.type) ? T.mintDark : T.g5, fontSize: 13, fontWeight: 700,
            }}>{eaten.has(m.type) ? "✓ Eaten today" : "Mark as eaten"}</button>
          )}
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
        <span style={{ color: T.onDark, fontWeight: 700 }}>{value}<span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>/{target}g</span></span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.15)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 99, transition: "width 1s cubic-bezier(.22,.68,0,1.2)" }} />
      </div>
    </div>
  );
}

function PlanScreen({ setTab, favorites, toggleFavorite, targets = TARGETS, live = false, mealLogs = [] }) {
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
  // Live mode reads real meal_logs for the selected day; demo mode uses the
  // deterministic generator so the app still tells a story with zero setup.
  const selISO = weekDates[day].toISOString().slice(0, 10);
  const liveHistory = () => {
    const rows = (mealLogs || []).filter(m => String(m.eaten_on).slice(0, 10) === selISO && m.done !== false);
    if (!rows.length) return {};
    const out = {};
    rows.forEach(r => { out[r.slot] = { name: r.name, emoji: r.emoji || "🍽", kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat, type: r.slot, done: true, prep: "", difficulty: "Easy", confidence: 92 }; });
    return out;
  };
  const history = isPast ? (live ? liveHistory() : historyFor(offsetDays)) : null;
  const histTotals = history ? types.reduce((a, t) => history[t] ? { kcal: a.kcal + history[t].kcal, protein: a.protein + history[t].protein, carbs: a.carbs + history[t].carbs, fat: a.fat + history[t].fat } : a, { kcal: 0, protein: 0, carbs: 0, fat: 0 }) : null;
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
        <button onClick={() => weekOffset > -3 && setWeekOffset(o => o - 1)} style={pagerBtn(weekOffset > -3)}><Icon name="chevronLeft" size={16} color={T.g6} /></button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.black }}>{weekLabel}</div>
          <div style={{ fontSize: 11, color: T.g4, marginTop: 1 }}>{fmt(weekDates[0])} – {fmt(weekDates[6])}</div>
        </div>
        <button onClick={() => weekOffset < 0 && setWeekOffset(o => o + 1)} style={pagerBtn(weekOffset < 0)}><Icon name="chevronRight" size={16} color={T.g6} /></button>
      </div>
      {/* Week strip */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4 }}>
        {DAYS.map((d, i) => (
          <button key={d} onClick={() => setDay(i)} style={{
            flexShrink: 0, width: 48, padding: "10px 0", borderRadius: 14, border: "none", cursor: "pointer",
            background: day === i ? T.mintDark : weekOffset === 0 && i === TODAY ? T.mintLight : T.white,
            boxShadow: day === i ? shadow.md : shadow.sm, transition: "all .18s cubic-bezier(.34,1.56,.64,1)",
          }}>
            <div style={{ fontSize: 11, color: day === i ? T.onAccent : T.g4, fontWeight: 600, marginBottom: 4 }}>{d}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: day === i ? T.onAccent : T.black }}>{weekDates[i].getDate()}</div>
            {weekOffset === 0 && i === TODAY && day !== i && <div style={{ width: 5, height: 5, borderRadius: 99, background: T.mintDark, margin: "4px auto 0" }} />}
          </button>
        ))}
      </div>
      {/* Daily summary for past days */}
      {isPast && (
        <div style={{ ...card, marginBottom: 12, padding: "16px 18px", animation: "popIn .25s ease both" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1 }}><Icon name="calendar" size={13} color={T.g5} sw={1.6} />Daily summary</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: histTotals.kcal <= targets.kcal ? T.mintDark : T.warn }}>{histTotals.kcal} / {targets.kcal} kcal</span>
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
        const planned = isPast ? !!meal : isToday;
        return (
          <div key={type} style={{ marginBottom: 10 }}>
            <button onClick={() => setExpanded(isOpen ? null : type)} style={{
              width: "100%", ...card, padding: "14px 18px", border: "none", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {planned
                  ? <DishTile name={meal.name} slot={type} size={42} radius={13} />
                  : <div style={{ width: 42, height: 42, borderRadius: 13, background: T.g1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="sparkles" size={18} color={T.g3} sw={1.6} /></div>}
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: 11, color: T.g4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8 }}>{type}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.black }}>{planned ? meal.name : "Not planned"}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {planned && <span style={{ fontSize: 13, fontWeight: 700, color: T.g4 }}>{meal.kcal} kcal</span>}
                <span style={{ display: "flex", color: T.g4, transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}><Icon name="chevronDown" size={16} color={T.g4} /></span>
              </div>
            </button>
            {isOpen && planned && (
              <div style={{ marginTop: 6, animation: "popIn .25s ease both" }}>
                <MealCard meal={meal} isFav={favorites.some(f => f.name === meal.name)} onFav={toggleFavorite} />
              </div>
            )}
            {isOpen && !planned && (
              <div style={{ ...card, marginTop: 6, padding: "24px", textAlign: "center", animation: "popIn .25s ease both" }}>
                <div style={{ width: 48, height: 48, borderRadius: 15, background: T.mintLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Icon name="sparkles" size={22} color={T.mintDark} sw={1.6} /></div>
                <div style={{ fontSize: 14, color: T.g4 }}>No meal planned for this day.</div>
                <Btn label="Generate with AI" primary small onPress={() => setTab("ai")} style={{ marginTop: 12 }} />
              </div>
            )}
          </div>
        );
      })}
      {/* Daily fun fact */}
      <div style={{ ...card, marginTop: 16, background: T.mintLight, border: "none", padding: "18px 20px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <Icon name="bulb" size={18} color={T.mintDark} sw={1.6} style={{ marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.mintDark, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6 }}>Did you know?</div>
          <div style={{ fontSize: 13, color: T.g6, lineHeight: 1.6 }}>{FUN_FACTS[day % FUN_FACTS.length]}</div>
        </div>
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
      setError("Add at least one ingredient first — start typing to search, tap a quick-add, or scan your fridge.");
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
        <button onClick={() => setStep("input")} style={{ width: 36, height: 36, borderRadius: 99, background: T.white, boxShadow: shadow.sm, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="arrowLeft" size={17} color={T.g6} /></button>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, color: T.black, letterSpacing: -0.4 }}>Your recipes</div>
          <div style={{ fontSize: 12, color: T.g4 }}>
            {loading ? `Cooking up ideas for ${goal}…` : `${ingredients.slice(0, 3).join(", ")}${ingredients.length > 3 ? ` +${ingredients.length - 3} more` : ""}`}
          </div>
        </div>
      </div>
      {recipes.map((r, i) => <AICard key={i} recipe={r} index={i} onSave={onSaveRecipe} onReplace={(idx, next) => setRecipes(prev => prev.map((x, j) => j === idx ? next : x))} />)}
      {loading && recipes.length < 3 && (
        <div style={{ ...card, background: T.white, marginBottom: 14, padding: "20px", animation: "fadeUp 0.4s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ display: "inline-flex", animation: "spin 1.6s linear infinite", color: T.mintDark }}><Icon name="sparkles" size={16} color={T.mintDark} /></span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: T.g5 }}>Writing recipe {recipes.length + 1} of 3…</span>
          </div>
          {streamName
            ? <div style={{ fontSize: 16, fontWeight: 700, color: T.black, letterSpacing: -0.3 }}>{streamName}</div>
            : <div style={{ fontSize: 16, fontWeight: 700, color: T.g4, letterSpacing: -0.3 }}>Thinking…</div>}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: "16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
          <Icon name="sparkles" size={14} color={T.mintDark} sw={1.6} />
          <div style={{ fontSize: 11, fontWeight: 700, color: T.mintDark, textTransform: "uppercase", letterSpacing: 1 }}>Nutrition coach</div>
        </div>
        <div style={{ fontSize: 27, fontWeight: 600, color: T.black, letterSpacing: -0.7 }}>What's in your kitchen?</div>
      </div>

      {/* Ingredient chips input */}
      <div style={{ ...card, padding: "16px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.black }}>Ingredients</div>
          <button onClick={() => { if (scanning) return; if (!pro && usage.scan >= FREE_LIMITS.scan) { openPaywall(); return; } if (fileRef.current) fileRef.current.click(); }} style={{
            display: "flex", alignItems: "center", gap: 6, border: `1px solid ${T.g2}`, background: "transparent", color: T.g6, borderRadius: 99,
            padding: "7px 13px 7px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: scanning ? 0.7 : 1,
          }}><Icon name="camera" size={14} color={T.g6} />{scanning ? "Scanning…" : "Scan fridge"}</button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFridgePhoto} style={{ display: "none" }} />
        <div onClick={() => inputRef.current?.focus()} style={{
          minHeight: 54, border: `1.5px solid ${T.g2}`, borderRadius: 14, padding: "10px 14px",
          display: "flex", flexWrap: "wrap", gap: 7, alignItems: "flex-start", cursor: "text", background: T.g1,
        }}>
          {ingredients.map(ing => (
            <span key={ing} style={{ background: T.mintDark, color: T.onAccent, borderRadius: 99, padding: "5px 12px 5px 14px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
              {ing}
              <button onClick={e => { e.stopPropagation(); setIngredients(p => p.filter(i => i !== ing)); }}
                style={{ background: "rgba(255,255,255,0.2)", border: "none", color: T.onAccent, cursor: "pointer", padding: 0, fontSize: 14, width: 18, height: 18, borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
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
        <div style={{ fontSize: 11, color: T.g4, marginTop: 8 }}>Tip: start typing to search · tap a match to add it · or scan a photo of your fridge</div>
      </div>

      {/* Goal selector */}
      <div style={{ ...card, marginBottom: 14, padding: "16px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Nutrition Goal</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {GOAL_OPTS.map(g => (
            <button key={g} onClick={() => setGoal(g)} style={{
              padding: "8px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
              background: goal === g ? T.mintDark : T.g1, color: goal === g ? T.onAccent : T.g5, transition: "all .18s cubic-bezier(.34,1.56,.64,1)",
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

      {error && <div style={{ background: "#FBEEE8", border: "1px solid rgba(178,59,46,0.22)", borderRadius: 14, padding: "12px 16px", marginBottom: 14, color: T.error, fontSize: 13 }}>{error}</div>}

      <Btn label={loading ? "Generating…" : ingredients.length ? `Generate 3 recipes (${ingredients.length} ingredient${ingredients.length > 1 ? "s" : ""})` : "Add ingredients to generate"} primary
        onPress={generate} style={{ width: "100%", opacity: !ingredients.length ? 0.6 : 1 }} />
      {!pro && (
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 6, fontSize: 12, color: T.g4, marginTop: 12 }}>
          <span>{Math.max(0, FREE_LIMITS.gen - usage.gen)} of {FREE_LIMITS.gen} free generations left today</span>
          <span style={{ width: 3, height: 3, borderRadius: 99, background: T.g3 }} />
          <span onClick={openPaywall} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.mintDark, fontWeight: 600, cursor: "pointer" }}><Icon name="infinity" size={14} color={T.mintDark} />Go unlimited</span>
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
      <div style={{ width: 22, height: 22, borderRadius: 8, border: `1.5px solid ${item.done ? T.mintDark : T.g3}`, background: item.done ? T.mintDark : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}>
        {item.done && <Icon name="check" size={12} color={T.onAccent} sw={2.6} />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: item.done ? T.g4 : T.black, textDecoration: item.done ? "line-through" : "none" }}>{item.name}</div>
        {item.qty ? <div style={{ fontSize: 12, color: T.g4 }}>{item.qty}</div> : null}
      </div>
    </div>
  );
}

function GroceryScreen({ items, setItems, onAdd, onToggle }) {
  const [newItem, setNewItem] = useState("");
  const total = items.length;
  const done = items.filter(i => i.done).length;
  const toggle = id => setItems(p => p.map(i => {
    if (i.id !== id) return i;
    onToggle?.(id, !i.done);
    return { ...i, done: !i.done };
  }));
  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    if (items.some(i => i.name.toLowerCase() === t.toLowerCase())) { setNewItem(""); return; }
    const item = { id: Date.now(), name: t.charAt(0).toUpperCase() + t.slice(1), qty: "", cat: guessCategory(t), done: false };
    setItems(p => [...p, item]);
    onAdd?.(item);
    setNewItem("");
  };
  const active = items.filter(i => !i.done);
  const inCart = items.filter(i => i.done);
  const CAT_ICON = { "From Recipes": "leaf", Proteins: "drumstick", Vegetables: "salad", Grains: "wheat", Fruits: "apple", Dairy: "milk", Other: "basket" };
  const CAT_COLOR = { "From Recipes": "#2F5D45", Proteins: "#A4735E", Vegetables: "#3F7A5A", Grains: "#A8853F", Fruits: "#A4735E", Dairy: "#6E8FA0", Other: T.g5 };
  const cats = Object.keys(CAT_ICON).filter(c => active.some(i => i.cat === c));

  return (
    <div style={{ padding: "16px" }}>
      <div style={{ fontSize: 27, fontWeight: 600, color: T.black, marginBottom: 8, letterSpacing: -0.7 }}>Basket</div>
      <div style={{ ...card, background: T.mintLight, border: "none", padding: "14px 16px", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: T.g6, lineHeight: 1.55 }}>
          <strong style={{ color: T.mintDark }}>What is this?</strong> Your shopping list for this week's meals. Tap items to check them off as you shop — and when you Save an AI recipe, its ingredients land here automatically.
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
          <div style={{ display: "flex", gap: 9, alignItems: "center", padding: "6px 0 4px" }}>
            <Icon name={CAT_ICON[cat]} size={15} color={CAT_COLOR[cat]} sw={1.6} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 0.8 }}>{cat}</span>
          </div>
          {active.filter(i => i.cat === cat).map(i => <GroceryRow key={i.id} item={i} onToggle={() => toggle(i.id)} />)}
        </div>
      ))}
      {active.length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: "30px 20px", marginBottom: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 15, background: T.mintLight, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Icon name="check" size={22} color={T.mintDark} sw={2.2} /></div>
          <div style={{ fontSize: 14, color: T.g5 }}>All done — everything is in your basket.</div>
        </div>
      )}
      {inCart.length > 0 && (
        <div style={{ ...card, marginTop: 6, padding: "12px 18px", background: T.g1, animation: "slideUp .3s cubic-bezier(.22,.68,0,1) both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 700, color: T.g5, textTransform: "uppercase", letterSpacing: 0.8, padding: "4px 0 2px" }}><Icon name="check" size={14} color={T.g5} sw={2.2} />In the basket ({inCart.length})</div>
          {inCart.map(i => <GroceryRow key={i.id} item={i} onToggle={() => toggle(i.id)} />)}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onFlip }) {
  return (
    <div onClick={onFlip} style={{ width: 46, height: 28, borderRadius: 99, background: on ? T.mintDark : T.g2, position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
      <div style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 22, height: 22, borderRadius: 99, background: T.onDark, boxShadow: shadow.sm, transition: "left 0.2s" }} />
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
      <polyline points={line} fill="none" stroke="#A9CBBA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((pt, i) => (
        <circle key={i} cx={pt[0]} cy={pt[1]} r={i === pts.length - 1 ? 4 : 2.5}
          fill={i === pts.length - 1 ? "#FFFFFF" : "#A9CBBA"} stroke="#A9CBBA" strokeWidth={i === pts.length - 1 ? 2 : 0} />
      ))}
    </svg>
  );
}

function ProfileScreen({ units, setUnits, weights, setWeights, prefs, setPrefs, pro, openPaywall, favorites, setFavorites, tryList, setTryList,
  userName = USER.name, userGoal = USER.goal, targetLbs = USER.targetLbs, targets = TARGETS, streak = USER.streak, email, onSignOut, onLogWeight, onRemoveFavorite, onRemoveTry, theme = "light", onToggleTheme }) {
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
    onLogWeight?.(asLbs);
    setLogVal("");
  };

  if (sub) return (
    <div style={{ padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <button onClick={() => setSub(null)} style={{ width: 36, height: 36, borderRadius: 99, background: T.white, boxShadow: shadow.sm, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="arrowLeft" size={17} color={T.g6} /></button>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.black, letterSpacing: -0.3 }}>{sub}</div>
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
          {["Apple Health", "Garmin Connect", "Google Fit", "MyFitnessPal"].map((a, i, arr) => (
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
                  <span style={{ display: "flex", color: T.g4, transform: faqOpen === q ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}><Icon name="chevronDown" size={15} color={T.g4} /></span>
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
          <div style={{ ...card, textAlign: "center", padding: "34px 20px" }}>
            <div style={{ width: 48, height: 48, borderRadius: 15, background: T.g1, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Icon name="heart" size={22} color={T.g3} /></div>
            <div style={{ fontSize: 14, color: T.g4, lineHeight: 1.6 }}>No favorites yet — tap the heart on any meal.</div>
          </div>
        ) : (
          favorites.map((f, i) => (
            <div key={f.name} style={{ ...card, padding: "14px 18px", marginBottom: 10, display: "flex", alignItems: "center", gap: 12, animation: "slideUp .35s cubic-bezier(.22,.68,0,1) both", animationDelay: `${i * 0.05}s` }}>
              <DishTile name={f.name} slot={f.type} size={44} radius={14} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.black, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.name}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.black }}>{f.kcal} kcal</span>
                  <Pill text={`P ${f.protein}g`} color={T.protein} bg={T.g1} size={10} />
                  <Pill text={`C ${f.carbs}g`} color={T.carbs} bg={T.g1} size={10} />
                  <Pill text={`F ${f.fat}g`} color={T.fat} bg={T.g1} size={10} />
                </div>
              </div>
              <button onClick={() => { setFavorites(p => p.filter(x => x.name !== f.name)); onRemoveFavorite?.(f.name); }} style={{ width: 28, height: 28, borderRadius: 99, border: "none", background: T.g1, color: T.g4, cursor: "pointer", fontSize: 13, flexShrink: 0, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}>✕</button>
            </div>
          ))
        )
      )}

      {sub === "Want to Try" && (
        tryList.length === 0 ? (
          <div style={{ ...card, textAlign: "center", padding: "34px 20px" }}>
            <div style={{ width: 48, height: 48, borderRadius: 15, background: T.g1, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><Icon name="bookmark" size={22} color={T.g3} /></div>
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
                      <Pill text={r.difficulty} color={T.onAccent} bg={diffBg} size={10} />
                    </div>
                  </div>
                  <button onClick={() => { setTryList(p => p.filter(x => x.name !== r.name)); onRemoveTry?.(r.name); }} style={{ width: 28, height: 28, borderRadius: 99, border: "none", background: T.g1, color: T.g4, cursor: "pointer", fontSize: 13, flexShrink: 0, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}>✕</button>
                </div>
                <button onClick={() => setTryOpen(isOpen ? null : r.name)} style={{
                  width: "100%", marginTop: 10, background: isOpen ? T.mintLight : T.g1, border: `1px solid ${isOpen ? T.mintDark : T.g2}`,
                  borderRadius: 14, padding: "10px 14px", cursor: "pointer", display: "flex",
                  justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 600, color: T.mintDark,
                }}>
                  <span>{isOpen ? "Hide" : "Show"} steps ({(r.steps || []).length})</span>
                  <span style={{ display: "flex", transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}><Icon name="chevronDown" size={16} color={T.mintDark} /></span>
                </button>
                {isOpen && (
                  <ol style={{ margin: "12px 0 0", padding: 0, animation: "popIn .25s ease both" }}>
                    {(r.steps || []).map((s, j) => (
                      <li key={j} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                        <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 99, background: T.mintDark, color: T.onAccent, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{j + 1}</span>
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
    { icon: "trendUp", label: "Current Weight", value: disp(lbs) },
    { icon: "target", label: "Target Weight", value: disp(targetLbs) },
    { icon: "flame", label: "Daily Calories", value: `${targets.kcal} kcal` },
    { icon: "drumstick", label: "Daily Protein", value: `${targets.protein}g` },
    { icon: "calendar", label: "Current Streak", value: `${streak} day${streak === 1 ? "" : "s"}` },
  ];
  const settingRows = ["Notification Preferences","Dietary Restrictions","Connected Apps","Privacy Settings","Help & Support"];
  return (
    <div style={{ padding: "16px" }}>
      {/* Profile header: identity left, weight trend right */}
      <div style={{ ...card, background: FOREST, padding: "20px", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <div style={{ width: 60, height: 60, borderRadius: 99, background: "rgba(255,255,255,0.10)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 600, color: T.mint, margin: "0 auto 8px" }}>{String(userName).trim().charAt(0).toUpperCase() || "C"}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.onDark }}>{userName}{pro && <span style={{ marginLeft: 6, background: T.mint, color: "#12251B", borderRadius: 99, padding: "1px 7px", fontSize: 9, fontWeight: 800, verticalAlign: "middle", letterSpacing: 0.5 }}>PRO</span>}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(169,203,186,0.18)", borderRadius: 99, padding: "4px 11px", marginTop: 6 }}>
              <Icon name="target" size={11} color={T.mint} sw={1.8} />
              <span style={{ fontSize: 11, fontWeight: 600, color: T.mint }}>{userGoal}</span>
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
              <button key={u} onClick={() => setUnits(u)} style={{ border: "none", cursor: "pointer", borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 700, background: units === u ? T.mintDark : "transparent", color: units === u ? T.onAccent : T.g4, transition: "all .18s cubic-bezier(.34,1.56,.64,1)" }}>{u === "imperial" ? "lbs" : "kg"}</button>
            ))}
          </div>
        </div>
        {statRows.map((s, i) => (
          <div key={s.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${T.g1}` }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Icon name={s.icon} size={18} color={T.g5} sw={1.6} />
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
        <MacroBar label="Protein" value={targets.protein} max={targets.protein + targets.carbs + targets.fat} color={T.protein} />
        <MacroBar label="Carbohydrates" value={targets.carbs} max={targets.protein + targets.carbs + targets.fat} color={T.carbs} />
        <MacroBar label="Fat" value={targets.fat} max={targets.protein + targets.carbs + targets.fat} color={T.fat} />
      </div>

      {/* Achievement badges */}
      <div style={{ ...card, marginBottom: 14, padding: "16px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.black, marginBottom: 14 }}>Achievements</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-around" }}>
          {ACHIEVEMENTS.map(a => (
            <div key={a.label} style={{ textAlign: "center", width: 72 }}>
              <div style={{ width: 48, height: 48, margin: "0 auto 8px", borderRadius: 15, background: a.tint, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name={a.icon} size={20} color={a.fg} sw={1.6} /></div>
              <div style={{ fontSize: 11, fontWeight: 500, color: T.g5, lineHeight: 1.3 }}>{a.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* My Recipe Box */}
      <div style={{ ...card, marginBottom: 14, padding: "6px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.black, padding: "12px 0 2px" }}>My Recipe Box</div>
        {[["heart", "Favorite Dishes", favorites.length], ["bookmark", "Want to Try", tryList.length]].map(([ic, target, count], i, arr) => (
          <div key={target} onClick={() => setSub(target)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: i < arr.length - 1 ? `1px solid ${T.g1}` : "none", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <Icon name={ic} size={18} color={T.g6} sw={1.6} />
              <span style={{ fontSize: 15, color: T.black, fontWeight: 500 }}>{target}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: T.mintLight, color: T.mintDark, fontSize: 12, fontWeight: 700, borderRadius: 99, padding: "2px 10px" }}>{count}</span>
              <Icon name="chevronRight" size={16} color={T.g3} />
            </div>
          </div>
        ))}
      </div>

      {/* Appearance */}
      {onToggleTheme && (
        <div style={{ ...card, marginBottom: 14, padding: "6px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <Icon name="moon" size={18} color={T.g6} sw={1.6} />
              <span style={{ fontSize: 15, color: T.black, fontWeight: 500 }}>Dark mode</span>
            </div>
            <Toggle on={theme === "dark"} onFlip={onToggleTheme} />
          </div>
        </div>
      )}

      {/* Settings */}
      <div style={{ ...card, marginBottom: 14, padding: "6px 18px" }}>
        {settingRows.map((s, i) => (
          <div key={s} onClick={() => setSub(s)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: i < settingRows.length - 1 ? `1px solid ${T.g1}` : "none", cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <Icon name={{ "Notification Preferences": "bell", "Dietary Restrictions": "salad", "Connected Apps": "link", "Privacy Settings": "shield", "Help & Support": "bulb" }[s]} size={18} color={T.g6} sw={1.6} />
              <span style={{ fontSize: 15, color: T.black, fontWeight: 500 }}>{s}</span>
            </div>
            <Icon name="chevronRight" size={16} color={T.g3} />
          </div>
        ))}
      </div>

      {!pro && (
        <div onClick={openPaywall} style={{ ...card, marginBottom: 14, padding: "16px 20px", background: FOREST, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.onDark }}>NutriCook Pro</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 3, lineHeight: 1.4 }}>Unlimited recipes, scans & remixes · $4.99/mo</div>
          </div>
          <Icon name="chevronRight" size={18} color={T.mint} />
        </div>
      )}
      {onSignOut && (
        <div style={{ ...card, marginBottom: 14, padding: "6px 18px" }}>
          {email && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", borderBottom: `1px solid ${T.g1}` }}>
              <span style={{ fontSize: 15, color: T.g5, fontWeight: 500 }}>Account</span>
              <span style={{ fontSize: 13, color: T.g4, maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</span>
            </div>
          )}
          <div onClick={onSignOut} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 0", cursor: "pointer" }}>
            <span style={{ fontSize: 15, color: T.error, fontWeight: 600 }}>Sign Out</span>
            <Icon name="chevronRight" size={16} color={T.g3} />
          </div>
        </div>
      )}
      <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
        <div style={{ fontSize: 12, color: T.g4 }}>NutriCook AI · v3.0</div>
        <div style={{ fontSize: 11, color: T.g3, marginTop: 2 }}>Powered by Claude</div>
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
        <div style={{ width: 38, height: 4, borderRadius: 99, background: T.g2, margin: "0 auto 22px" }} />
        <div style={{ width: 46, height: 46, borderRadius: 15, background: T.mintLight, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}><Icon name="leaf" size={22} color={T.mintDark} sw={1.6} /></div>
        <div style={{ fontSize: 25, fontWeight: 600, color: T.black, letterSpacing: -0.6, marginBottom: 8 }}>Cook without limits</div>
        <div style={{ fontSize: 14, color: T.g4, lineHeight: 1.55, marginBottom: 22, maxWidth: 300 }}>You've used today's free generations. Pro keeps the coach available whenever you open the fridge.</div>
        <div style={{ marginBottom: 22 }}>
          {["Unlimited recipe generation", "Unlimited fridge scans", "Remix any recipe, any time", "Priority generation speed"].map((t, i, arr) => (
            <div key={t} style={{ display: "flex", gap: 12, alignItems: "center", padding: "13px 0", borderTop: `1px solid ${T.g1}`, borderBottom: i === arr.length - 1 ? `1px solid ${T.g1}` : "none" }}>
              <Icon name="check" size={16} color={T.mintDark} sw={2.2} />
              <span style={{ fontSize: 14.5, fontWeight: 500, color: T.g6 }}>{t}</span>
            </div>
          ))}
        </div>
        <Btn label={busy ? "Opening checkout…" : "Start Pro — $4.99 / month"} primary onPress={busy ? () => {} : onUpgrade} style={{ width: "100%", marginBottom: 6 }} />
        <button onClick={onClose} style={{ width: "100%", background: "transparent", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, color: T.g4, padding: "10px" }}>Not now</button>
        <div style={{ fontSize: 11, color: T.g4, textAlign: "center", marginTop: 6 }}>Unlimited until your next billing date. Cancel anytime.</div>
      </div>
    </div>
  );
}

// ── Bottom Nav ───────────────────────────────────────────
const NAV = [
  { id: "home", icon: "home", label: "Today" },
  { id: "plan", icon: "calendar", label: "Plan" },
  { id: "ai", icon: "sparkles", label: "", fab: true },
  { id: "grocery", icon: "basket", label: "Basket" },
  { id: "profile", icon: "user", label: "You" },
];

function BottomNav({ tab, setTab }) {
  return (
    <div style={{
      position: "absolute", bottom: 0, left: 0, right: 0,
      background: "rgba(247,246,243,0.88)", backdropFilter: "blur(22px)",
      borderTop: `1px solid ${T.g2}`, paddingBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "flex-end", height: 64 }}>
        {NAV.map(n => n.fab ? (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            flex: 1, display: "flex", justifyContent: "center", alignItems: "center",
            border: "none", background: "transparent", cursor: "pointer", paddingBottom: 10,
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 18, marginTop: -18, background: FOREST,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 10px 22px -6px rgba(47,93,69,0.5)`,
              animation: "pulseGlow 2.6s ease-in-out infinite",
              transition: "transform .25s cubic-bezier(.34,1.56,.64,1)", transform: tab === n.id ? "scale(1.08)" : "scale(1)",
            }}><Icon name="sparkles" size={23} color="#F7F6F3" sw={1.6} /></div>
          </button>
        ) : (
          <button key={n.id} onClick={() => setTab(n.id)} style={{
            flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            border: "none", background: "transparent", cursor: "pointer", height: "100%", gap: 5, paddingTop: 6,
          }}>
            <span style={{ transition: "transform .25s cubic-bezier(.34,1.56,.64,1)", transform: tab === n.id ? "translateY(-2px)" : "translateY(0)" }}><Icon name={n.icon} size={22} color={tab === n.id ? T.mintDark : T.g4} sw={tab === n.id ? 1.9 : 1.6} /></span>
            <span style={{ fontSize: 10.5, fontWeight: tab === n.id ? 600 : 500, color: tab === n.id ? T.mintDark : T.g4 }}>{n.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main App (post-auth) ─────────────────────────────────
// `boot` is the loaded Supabase data in live mode, or null in demo mode. Every
// state initializer falls back to the v2.5 seed data when boot is absent, so the
// demo experience is byte-for-byte unchanged.
function MainApp({ boot, mode, email, onSignOut }) {
  const live = mode === "live";
  const profile = boot?.profile || null;
  const userName = profile?.name || USER.name;
  const userGoal = profile?.goal || USER.goal;
  const targetLbs = profile?.target_lbs ?? USER.targetLbs;
  const targets = profile
    ? { kcal: profile.kcal_target, protein: profile.protein_target, carbs: profile.carbs_target, fat: profile.fat_target, water: profile.water_target }
    : TARGETS;
  const streak = live ? computeStreak(boot?.mealLogs || []) : USER.streak;

  const [tab, setTab] = useState("home");
  const [theme, setTheme] = useState(getInitialTheme);
  useEffect(() => { if (typeof document !== "undefined") document.documentElement.dataset.theme = theme; }, [theme]);
  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));
  const scrollRef = useRef(null);
  const [prefs, setPrefsRaw] = useState(profile?.dietary_prefs || []);
  const [units, setUnitsRaw] = useState(profile?.units || "imperial");
  const [weights, setWeights] = useState(boot?.weights?.length ? boot.weights : WEIGHT_SEED);
  const [groceryItems, setGroceryItems] = useState(
    boot?.grocery ? boot.grocery : Object.entries(GROCERY).flatMap(([cat, arr]) => arr.map(i => ({ ...i, cat })))
  );
  const [pro, setPro] = useState(live ? isProActive(boot?.sub) : false);
  const [usage, setUsage] = useState({ gen: 0, scan: 0 });
  const [paywall, setPaywall] = useState(false);
  const [favorites, setFavorites] = useState(boot?.favorites || []);
  const [tryList, setTryList] = useState(boot?.tryList || []);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const mealLogs = boot?.mealLogs || [];

  // Write-through helpers: persist to Supabase in live mode, no-op in demo.
  const persist = (fn, ...args) => { if (live) Promise.resolve(fn(...args)).catch(() => {}); };
  const setPrefs = updater => setPrefsRaw(prev => {
    const next = typeof updater === "function" ? updater(prev) : updater;
    persist(db.updateProfile, { dietary_prefs: next });
    return next;
  });
  const setUnits = u => { setUnitsRaw(u); persist(db.updateProfile, { units: u }); };

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("upgraded") === "1") {
      setPro(true);
      window.history.replaceState({}, "", window.location.pathname);
      // Confirm against the webhook-written subscription (it may lag a moment).
      if (live) setTimeout(() => supabase.from("subscriptions").select("*").maybeSingle()
        .then(({ data }) => { if (data) setPro(isProActive(data)); }), 4000);
    }
  }, []);
  const useQuota = kind => setUsage(u => ({ ...u, [kind]: u[kind] + 1 }));
  const startCheckout = async () => {
    setCheckoutBusy(true);
    try {
      const headers = {};
      if (live) {
        const { data } = await supabase.auth.getSession();
        if (data?.session) headers.Authorization = `Bearer ${data.session.access_token}`;
      }
      const res = await fetch("/api/checkout", { method: "POST", headers });
      const d = await res.json();
      if (d.url) { window.location.href = d.url; return; }
    } catch {}
    // Simulated mode (no Stripe keys configured): activate Pro directly.
    setPro(true);
    setPaywall(false);
    setCheckoutBusy(false);
  };
  const saveRecipeToGrocery = recipe => {
    let added = [];
    setGroceryItems(p => {
      const have = p.map(x => x.name.toLowerCase());
      added = (recipe.ingredients || [])
        .map(n => String(n).trim())
        .filter(n => n && !have.includes(n.toLowerCase()))
        .map((n, i) => ({ id: Date.now() + i, name: n.charAt(0).toUpperCase() + n.slice(1), qty: "", cat: "From Recipes", done: false }));
      return [...p, ...added];
    });
    return added;
  };
  const toggleFavorite = meal => setFavorites(p => {
    if (p.some(f => f.name === meal.name)) { persist(db.removeFavorite, meal.name); return p.filter(f => f.name !== meal.name); }
    persist(db.addFavorite, meal);
    return [...p, { name: meal.name, emoji: meal.emoji, kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat }];
  });
  // Saving an AI recipe: grocery ingredients + Want-to-Try list, deduped by name.
  const onSaveRecipe = recipe => {
    const addedGrocery = saveRecipeToGrocery(recipe);
    setTryList(p => p.some(r => r.name === recipe.name) ? p : [...p, recipe]);
    persist(db.saveRecipe, recipe, addedGrocery);
  };
  const removeFavorite = name => { setFavorites(p => p.filter(x => x.name !== name)); persist(db.removeFavorite, name); };
  const removeTry = name => { setTryList(p => p.filter(x => x.name !== name)); persist(db.removeTryList, name); };
  const logWeightLbs = asLbs => persist(db.logWeight, asLbs);
  const onGroceryAdd = item => persist(db.addGrocery, item);
  const onGroceryToggle = (id, done) => persist(db.toggleGrocery, id, done);
  const onWater = glasses => persist(db.setWaterGlasses, glasses);
  const onMarkMeal = (meal, done) => persist(db.markMeal, meal, done);
  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [tab]);

  return (
    <>
      <style>{`
        ${THEME_CSS}
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(22px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn { 0% { opacity:0; transform:scale(.92); } 70% { opacity:1; transform:scale(1.015); } 100% { opacity:1; transform:scale(1); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes pulseGlow { 0%, 100% { box-shadow: 0 10px 22px -6px rgba(47,93,69,0.45); } 50% { box-shadow: 0 12px 28px -6px rgba(47,93,69,0.6); } }
        * { box-sizing: border-box; }
        body { margin: 0; background: var(--t-page); transition: background .25s ease; }
        button { font-family: inherit; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: var(--t-scroll); border-radius: 99px; }
      `}</style>

      <div style={{ maxWidth: 430, margin: "0 auto", height: "100vh", background: T.bg, position: "relative", overflow: "hidden", fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif" }}>
        {/* Status bar */}
        <div style={{ background: T.white, padding: "12px 20px 8px", display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, color: T.black, borderBottom: `1px solid ${T.g1}` }}>
          <span>9:41</span>
          <span style={{ fontSize: 11, color: T.mintDark, fontWeight: 700, letterSpacing: 0.5 }}>NUTRICOOK AI</span>
          {pro ? <span style={{ background: T.mintDark, color: T.onAccent, borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>PRO</span> : <span style={{ color: T.g4 }}>●●▮</span>}
        </div>

        {/* Scrollable content */}
        <div ref={scrollRef} style={{ height: "calc(100vh - 36px - 72px)", overflowY: "auto", overflowX: "hidden" }}>
          <div key={tab} style={{ animation: "slideUp 0.32s cubic-bezier(.22,.68,0,1) both" }}>
          {tab === "home" && <HomeScreen setTab={setTab} favorites={favorites} toggleFavorite={toggleFavorite} userName={userName} targets={targets} live={live} mealLogs={mealLogs} initialWater={boot?.water} onWater={onWater} onMarkMeal={onMarkMeal} />}
          {tab === "plan" && <PlanScreen setTab={setTab} favorites={favorites} toggleFavorite={toggleFavorite} targets={targets} live={live} mealLogs={mealLogs} />}
          {tab === "ai" && <AIScreen prefs={prefs} setPrefs={setPrefs} onSaveRecipe={onSaveRecipe} pro={pro} usage={usage} useQuota={useQuota} openPaywall={() => setPaywall(true)} />}
          {tab === "grocery" && <GroceryScreen items={groceryItems} setItems={setGroceryItems} onAdd={onGroceryAdd} onToggle={onGroceryToggle} />}
          {tab === "profile" && <ProfileScreen units={units} setUnits={setUnits} weights={weights} setWeights={setWeights} prefs={prefs} setPrefs={setPrefs} pro={pro} openPaywall={() => setPaywall(true)} favorites={favorites} setFavorites={setFavorites} tryList={tryList} setTryList={setTryList} userName={userName} userGoal={userGoal} targetLbs={targetLbs} targets={targets} streak={streak} email={email} onSignOut={onSignOut} onLogWeight={logWeightLbs} onRemoveFavorite={removeFavorite} onRemoveTry={removeTry} theme={theme} onToggleTheme={toggleTheme} />}
          </div>
        </div>

        <BottomNav tab={tab} setTab={setTab} />
        {paywall && <Paywall onClose={() => setPaywall(false)} onUpgrade={startCheckout} busy={checkoutBusy} />}
      </div>
    </>
  );
}

// ── Auth shell (phone frame used by the loading / auth / onboarding screens) ─
function GlobalStyle() {
  return (
    <style>{`
      ${THEME_CSS}
      @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
      @keyframes popIn { 0% { opacity:0; transform:scale(.92); } 70% { opacity:1; transform:scale(1.015); } 100% { opacity:1; transform:scale(1); } }
      * { box-sizing: border-box; }
      body { margin: 0; background: var(--t-page); }
      button, input { font-family: inherit; }
    `}</style>
  );
}
function Frame({ children }) {
  return (
    <>
      <GlobalStyle />
      <div style={{ maxWidth: 430, margin: "0 auto", height: "100vh", background: T.bg, position: "relative", overflow: "hidden", fontFamily: "-apple-system, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </>
  );
}

function AuthField({ label, ...props }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.g5, marginBottom: 6 }}>{label}</div>
      <input {...props} style={{ width: "100%", border: `1.5px solid ${T.g2}`, borderRadius: 12, padding: "13px 14px", fontSize: 15, outline: "none", background: T.white, color: T.black }} />
    </div>
  );
}

// ── Auth screen (email/password + Google) ────────────────
function AuthScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);

  const submit = async () => {
    if (busy) return;
    setErr(null); setMsg(null);
    if (!email.trim() || !pw) { setErr("Enter your email and password."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: pw, options: { data: { name: name.trim() } } });
        if (error) throw error;
        setMsg("Account created — you can start cooking. (If email confirmation is on, check your inbox first.)");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e?.message || "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  };
  const google = async () => {
    setErr(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
      if (error) throw error;
    } catch (e) {
      setErr(e?.message || "Google sign-in isn't available — use email instead.");
    }
  };

  return (
    <Frame>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 22px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ textAlign: "center", marginBottom: 24, animation: "fadeUp .4s ease both" }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, background: FOREST, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><Icon name="leaf" size={28} color="#F7F6F3" sw={1.6} /></div>
          <div style={{ fontSize: 27, fontWeight: 600, color: T.black, letterSpacing: -0.6 }}>NutriCook AI</div>
          <div style={{ fontSize: 14, color: T.g4, marginTop: 4 }}>{mode === "signup" ? "Create your account" : "Welcome back"}</div>
        </div>
        <div style={{ ...card, padding: "18px", animation: "fadeUp .4s ease .05s both" }}>
          {mode === "signup" && <AuthField label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Cesar" />}
          <AuthField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" onKeyDown={e => e.key === "Enter" && submit()} />
          <AuthField label="Password" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === "Enter" && submit()} />
          {err && <div style={{ fontSize: 13, color: T.error, marginBottom: 10 }}>{err}</div>}
          {msg && <div style={{ fontSize: 13, color: T.mintDark, marginBottom: 10 }}>✓ {msg}</div>}
          <Btn label={busy ? "…" : mode === "signup" ? "Create account" : "Sign in"} primary onPress={submit} style={{ width: "100%", marginBottom: 10 }} />
          <button onClick={google} style={{ width: "100%", padding: "13px", borderRadius: 12, border: `1.5px solid ${T.g2}`, background: T.white, color: T.g6, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>Continue with Google</button>
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <span style={{ fontSize: 13, color: T.g4 }}>{mode === "signup" ? "Already have an account?" : "New here?"} </span>
          <span onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setErr(null); setMsg(null); }} style={{ fontSize: 13, fontWeight: 700, color: T.mintDark, cursor: "pointer" }}>{mode === "signup" ? "Sign in" : "Create an account"}</span>
        </div>
      </div>
    </Frame>
  );
}

// ── Onboarding (name → goal → weight) ────────────────────
const GOAL_TARGETS = {
  "Fat Loss": { kcal: 1800, protein: 150, carbs: 150, fat: 60 },
  "Muscle Gain": { kcal: 2200, protein: 165, carbs: 220, fat: 73 },
  "Maintenance": { kcal: 2000, protein: 140, carbs: 200, fat: 66 },
  "High Protein": { kcal: 2100, protein: 180, carbs: 170, fat: 60 },
  "Low Carb": { kcal: 1900, protein: 160, carbs: 110, fat: 90 },
  "Balanced": { kcal: 2000, protein: 130, carbs: 210, fat: 67 },
};
function OnboardingScreen({ email, defaultName, onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(defaultName || "");
  const [goal, setGoal] = useState("Muscle Gain");
  const [units, setUnits] = useState("imperial");
  const [weight, setWeight] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const toLbs = v => { const n = parseFloat(v); if (!n) return null; return units === "metric" ? Math.round((n / 0.45359) * 10) / 10 : n; };

  const finish = async () => {
    if (busy) return;
    setBusy(true); setErr(null);
    const t = GOAL_TARGETS[goal];
    const wLbs = toLbs(weight);
    const tLbs = toLbs(target);
    try {
      await db.updateProfile({
        name: name.trim() || "there", goal, units,
        weight_lbs: wLbs, target_lbs: tLbs,
        kcal_target: t.kcal, protein_target: t.protein, carbs_target: t.carbs, fat_target: t.fat,
        dietary_prefs: [], onboarded: true,
      });
      await db.seedStarter(Object.entries(GROCERY).flatMap(([cat, arr]) => arr.map(i => ({ name: i.name, qty: i.qty, cat, done: i.done }))), wLbs);
      onDone();
    } catch (e) {
      setErr(e?.message || "Couldn't save — try again.");
      setBusy(false);
    }
  };

  const steps = ["Your name", "Your goal", "Your weight"];
  return (
    <Frame>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 22px" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 24 }}>
          {steps.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 5, borderRadius: 99, background: i <= step ? T.mintDark : T.g2, transition: "background .3s" }} />
          ))}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.mintDark, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Step {step + 1} of 3</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.black, letterSpacing: -0.4, marginBottom: 20 }}>{steps[step]}</div>

        {step === 0 && (
          <div style={{ animation: "fadeUp .35s ease both" }}>
            <AuthField label="What should we call you?" value={name} onChange={e => setName(e.target.value)} placeholder="Cesar" onKeyDown={e => e.key === "Enter" && setStep(1)} />
          </div>
        )}
        {step === 1 && (
          <div style={{ animation: "fadeUp .35s ease both", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {GOAL_OPTS.map(g => (
              <button key={g} onClick={() => setGoal(g)} style={{
                padding: "10px 16px", borderRadius: 12, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
                background: goal === g ? T.mintDark : T.white, color: goal === g ? T.onAccent : T.g5, boxShadow: shadow.sm,
              }}>{g}</button>
            ))}
            <div style={{ width: "100%", fontSize: 12, color: T.g4, marginTop: 8 }}>Sets your daily calorie & macro targets (editable later in Profile).</div>
          </div>
        )}
        {step === 2 && (
          <div style={{ animation: "fadeUp .35s ease both" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
              <div style={{ display: "flex", background: T.g1, borderRadius: 99, padding: 3 }}>
                {["imperial", "metric"].map(u => (
                  <button key={u} onClick={() => setUnits(u)} style={{ border: "none", cursor: "pointer", borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 700, background: units === u ? T.mintDark : "transparent", color: units === u ? T.onAccent : T.g4 }}>{u === "imperial" ? "lbs" : "kg"}</button>
                ))}
              </div>
            </div>
            <AuthField label={`Current weight (${units === "metric" ? "kg" : "lbs"})`} inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} placeholder={units === "metric" ? "79" : "175"} />
            <AuthField label={`Target weight (${units === "metric" ? "kg" : "lbs"})`} inputMode="decimal" value={target} onChange={e => setTarget(e.target.value)} placeholder={units === "metric" ? "84" : "185"} />
          </div>
        )}
        {err && <div style={{ fontSize: 13, color: T.error, marginTop: 12 }}>{err}</div>}
      </div>
      <div style={{ padding: "16px 22px 28px", display: "flex", gap: 10 }}>
        {step > 0 && <Btn label="Back" onPress={() => setStep(s => s - 1)} style={{ flex: 1 }} />}
        {step < 2
          ? <Btn label="Continue" primary onPress={() => setStep(s => s + 1)} style={{ flex: 2 }} />
          : <Btn label={busy ? "Saving…" : "Start cooking"} primary onPress={finish} style={{ flex: 2 }} />}
      </div>
    </Frame>
  );
}

// ── Root: auth gate → onboarding → app; demo mode when Supabase is absent ──
export default function NutriCookApp() {
  // Demo mode: no Supabase configured → run exactly as v2.5 (session-only mock).
  if (!hasSupabase) return <MainApp boot={null} mode="demo" />;

  const [phase, setPhase] = useState("loading"); // loading | auth | onboarding | ready
  const [session, setSession] = useState(null);
  const [boot, setBoot] = useState(null);
  const [needName, setNeedName] = useState("");

  const bootstrap = async sess => {
    if (!sess) { setPhase("auth"); return; }
    const { data: prof } = await supabase.from("profiles").select("*").maybeSingle();
    if (!prof || !prof.onboarded) {
      setNeedName(sess.user?.user_metadata?.name || "");
      setPhase("onboarding");
      return;
    }
    try {
      const data = await db.loadAll();
      setBoot(data);
      setPhase("ready");
    } catch {
      setBoot({ profile: prof });
      setPhase("ready");
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); bootstrap(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      if (!sess) { setBoot(null); setPhase("auth"); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Theme the pre-app screens (loading / auth / onboarding) to match the OS
  // before MainApp mounts and takes over the data-theme attribute.
  useEffect(() => { if (typeof document !== "undefined" && !document.documentElement.dataset.theme) document.documentElement.dataset.theme = getInitialTheme(); }, []);

  const signOut = async () => { await supabase.auth.signOut(); setBoot(null); setPhase("auth"); };

  if (phase === "loading") return (
    <Frame>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ display: "inline-flex", animation: "spin 1.4s linear infinite", color: T.mintDark }}><Icon name="sparkles" size={32} color={T.mintDark} /></span>
      </div>
    </Frame>
  );
  if (phase === "auth") return <AuthScreen />;
  if (phase === "onboarding") return <OnboardingScreen email={session?.user?.email} defaultName={needName} onDone={() => bootstrap(session)} />;
  return <MainApp boot={boot} mode="live" email={session?.user?.email} onSignOut={signOut} />;
}

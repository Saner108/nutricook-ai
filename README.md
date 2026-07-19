# 🌿 NutriCook AI

**Turn your ingredients into personalized recipes — powered by Claude AI.**

NutriCook AI is a full-stack nutrition coaching application that generates personalized meal plans and recipes based on available ingredients, dietary preferences, and health goals. Built as part of the Claude Corps Fellowship portfolio by Cesar, Head Nutrition Coach at TAMUCC Recreational Sports Center.

---

## Live Demo

> Open the project in Claude.ai or deploy via Vercel/Netlify for a shareable link.

---

## Features

**🏠 Home Dashboard**
- Personalized greeting and daily nutrition summary
- Animated calorie progress ring with macro breakdown (protein, carbs, fat)
- Water intake tracker
- AI meal plan banner with one-tap regeneration
- Today's meal cards with AI confidence scores

**📅 Weekly Meal Planner**
- 7-day horizontal calendar navigation
- Expandable meal sections (Breakfast, Lunch, Dinner, Snack)
- Meal details with nutrition info, prep time, and difficulty

**🌿 AI Meal Generator** *(core feature)*
- Ingredient chip input — type and press Enter to add
- Quick-add common ingredients
- 6 nutrition goal presets (Fat Loss, Muscle Gain, Maintenance, etc.)
- 8 dietary preference toggles (Vegan, Gluten-Free, Keto, etc.)
- Generates 3 personalized recipes with full nutrition info
- Animated macro bars per recipe
- Step-by-step instructions

**🛒 Smart Grocery List**
- Auto-grouped by category (Proteins, Vegetables, Grains, Fruits, Dairy)
- Interactive checkboxes with live progress bar
- Tap any category to expand/collapse

**👤 Profile**
- Health goals, weight tracking, streak counter
- Macro split visualization
- Achievement badges
- App settings

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Inline styles (iOS design system) |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Deployment | Vercel / Netlify |

---

## Getting Started

### Prerequisites
- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

### Installation

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/nutricook-ai.git
cd nutricook-ai

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Adding Your API Key

When the app loads, you'll see a yellow banner at the top:

1. Click **"Add Key →"**
2. Paste your Anthropic API key (starts with `sk-ant-`)
3. Click **Save**
4. Navigate to the **AI tab** (🌿 center button) to generate recipes

> **Note:** The API key is stored in React state only — it is never saved to disk, localStorage, or any server. Each session requires re-entering the key. For a production deployment, move the API call to a backend server to keep your key secure.

---

## Deployment

### Vercel (recommended)
```bash
npm install -g vercel
vercel
```

### Netlify
```bash
npm run build
# Drag the `dist/` folder to netlify.com/drop
```

---

## Project Structure

```
nutricook-ai/
├── src/
│   ├── App.jsx          # Full application (all screens + components)
│   └── main.jsx         # React entry point
├── index.html
├── vite.config.js
├── package.json
└── README.md
```

---

## AI Integration

The AI Generator uses a structured JSON prompt to ensure consistent, parseable output from Claude:

```javascript
// Prompt requests 3 recipes as strict JSON
const prompt = `Generate exactly 3 different recipes using: ${ingredients}.
Goal: ${goal}. ${dietaryRequirements}
Return ONLY valid JSON: {"recipes": [{ "name", "difficulty", "prepTime", "servings", "macros": {...}, "steps": [...] }]}`;

// API call with direct browser access header
const response = await fetch("https://api.anthropic.com/v1/messages", {
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  },
  body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages })
});
```

---

## Design System

Inspired by Apple Human Interface Guidelines:

| Token | Value | Use |
|-------|-------|-----|
| `mint` | `#A8F5D3` | Primary accent |
| `mintDark` | `#1A8C5F` | CTA buttons, active states |
| `mintLight` | `#F0FBF6` | Card backgrounds, selections |
| `black` | `#1C1C1E` | Primary text |
| `g4` | `#8E8E93` | Secondary text |
| Border radius | 14–20px | Cards and buttons |

---

## Background

This project was built as part of the **Claude Corps Fellowship (Cohort 1)** application. The nutrition coaching focus comes from real-world experience building client assessment programs at TAMUCC, where tracking ingredients, macros, and personalized meal planning are daily challenges for coaching clients.

The Excel-based tools in this portfolio (Budget Tracker, Cooking Inventory) informed the data structure for the meal planning and grocery list features.

---

## Author

**Cesar** — Head Nutrition Coach, TAMUCC Recreational Sports Center  
Claude Corps Fellowship Applicant, Cohort 1

---

## License

MIT — free to use, modify, and share.

---

## Environment Variables (Vercel → Project Settings)

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | For live AI | Powers recipe generation, fridge scan, and remixes via the `/api/generate` proxy. Never exposed to the browser. |
| `STRIPE_SECRET_KEY` | Optional | Enables real Stripe Checkout for NutriCook Pro (use test-mode keys first). |
| `STRIPE_PRICE_ID` | Optional | The recurring price for the $4.99/mo Pro subscription. |
| `STRIPE_WEBHOOK_SECRET` | Optional | Verifies `api/stripe-webhook.js` events. |

Without the Stripe keys, upgrading simulates instantly (demo mode). Without the Anthropic key, local dev serves realistic mocks.

## Business Model

Free tier: **3 recipe generations + 1 fridge scan per day** — enough to love the app.
**NutriCook Pro ($4.99/mo):** unlimited generation, unlimited fridge scans, unlimited AI remixes until the next billing date. Checkout via Stripe subscription mode; webhook receives lifecycle events. (Per-user enforcement across devices requires auth + a datastore — the next phase.)

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only /api/generate so `npm run dev` works like production Vercel.
// With ANTHROPIC_API_KEY set: real proxy to Anthropic (incl. SSE streaming).
// Without it: realistic mock responses so the full UX is testable offline.
const MOCK_INGREDIENTS = { ingredients: ["chicken", "broccoli", "bell peppers", "eggs", "cheddar cheese"] };
const MOCK_RECIPES = {
  recipes: [
    { name: "Garlic Chicken & Broccoli Stir-Fry", difficulty: "Easy", prepTime: "20 min", servings: 2,
      macros: { calories: 480, protein: 46, carbs: 28, fat: 20 },
      ingredients: ["1 lb chicken breast", "2 cups broccoli florets", "3 cloves garlic", "2 tbsp soy sauce", "1 tbsp olive oil"],
      steps: ["Slice chicken into strips and season with salt.", "Heat oil in a wok over high heat.", "Sear chicken 4–5 min until golden.", "Add broccoli and garlic; stir-fry 3 min.", "Toss with a splash of soy sauce and serve."] },
    { name: "Cheesy Veggie Egg Scramble", difficulty: "Easy", prepTime: "12 min", servings: 2,
      macros: { calories: 380, protein: 28, carbs: 10, fat: 26 },
      ingredients: ["6 eggs", "1 bell pepper", "1/2 cup cheddar cheese", "1 tbsp butter"],
      steps: ["Whisk eggs with a pinch of salt.", "Sauté diced peppers 2 min in butter.", "Pour in eggs; stir gently over low heat.", "Fold in cheddar until melted.", "Plate and finish with black pepper."] },
    { name: "Roasted Pepper Chicken Rice Bowl", difficulty: "Medium", prepTime: "30 min", servings: 2,
      macros: { calories: 560, protein: 42, carbs: 58, fat: 16 },
      ingredients: ["2 chicken breasts", "1 cup jasmine rice", "2 bell peppers", "1 tbsp olive oil", "1 tsp paprika"],
      steps: ["Roast peppers at 425°F for 15 min.", "Cook rice per package directions.", "Pan-sear seasoned chicken 6 min per side.", "Slice chicken; assemble bowls over rice.", "Top with roasted peppers and a drizzle of oil.", "Season to taste and serve warm."] },
  ],
};

function devApiPlugin() {
  return {
    name: 'dev-api-generate',
    configureServer(server) {
      server.middlewares.use('/api/checkout', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('{}'); return; }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ simulated: true }));
      });
      server.middlewares.use('/api/generate', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(JSON.stringify({ error: { message: 'Method not allowed' } })); return; }
        let raw = '';
        req.on('data', c => { raw += c; });
        req.on('end', async () => {
          let body = {};
          try { body = JSON.parse(raw || '{}'); } catch {}
          const key = process.env.ANTHROPIC_API_KEY;
          if (key) {
            try {
              const upstream = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (body.stream === true && upstream.ok && upstream.body) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
                res.setHeader('Cache-Control', 'no-cache, no-transform');
                for await (const chunk of upstream.body) res.write(Buffer.from(chunk));
                res.end();
                return;
              }
              const text = await upstream.text();
              res.statusCode = upstream.status;
              res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
              res.end(text);
            } catch {
              res.statusCode = 502; res.end(JSON.stringify({ error: { message: 'Upstream request to Anthropic failed' } }));
            }
            return;
          }
          console.log('[mock] serving /api/generate (no ANTHROPIC_API_KEY set)');
          const msgs = Array.isArray(body.messages) ? body.messages : [];
          const promptText = msgs.map(m => typeof m.content === 'string' ? m.content : '').join(' ');
          if (promptText.includes('Remix this recipe')) {
            const instr = (promptText.match(/Instruction: ([^.]+)/) || [])[1] || '';
            const label = instr.includes('spicier') ? 'Firecracker' : instr.includes('protein') ? 'Power Protein' : instr.includes('calories') ? 'Lean & Light' : instr.includes('servings') ? 'Family-Size' : 'Chef Swap';
            const remixed = { name: `${label} Chicken Skillet`, difficulty: 'Easy', prepTime: '18 min', servings: 2,
              macros: { calories: 430, protein: 48, carbs: 22, fat: 17 },
              ingredients: ['1 lb chicken breast', '2 cups broccoli florets', '1 jalapeño, sliced', '2 tbsp hot sauce', '1 tbsp olive oil'],
              steps: ['Slice chicken and season generously.', 'Sear in a hot skillet 5 min.', 'Add vegetables and aromatics; cook 4 min.', 'Finish with sauce and toss to coat.', 'Serve immediately.'] };
            setTimeout(() => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(remixed) }] })); }, 700);
            return;
          }
          const isVision = msgs.some(m => Array.isArray(m.content) && m.content.some(c => c && c.type === 'image'));
          const payload = JSON.stringify(isVision ? MOCK_INGREDIENTS : MOCK_RECIPES);
          if (body.stream === true) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            for (let i = 0; i < payload.length; i += 40) {
              res.write(`data: ${JSON.stringify({ type: 'content_block_delta', delta: { type: 'text_delta', text: payload.slice(i, i + 40) } })}\n\n`);
              await sleep(60);
            }
            res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
            res.end();
          } else {
            await new Promise(r => setTimeout(r, 600));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ content: [{ type: 'text', text: payload }] }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devApiPlugin()],
})

// People's Secrets — real conversational AI chatbot: backend proxy.
// WHY A SERVER IS NEEDED: the current site is a static page. A browser page
// cannot safely hold an AI API key, so the key must live here, on a server,
// and the site's chat widget talks only to this server, never to the AI API
// directly. This keeps the key secret and lets you control cost and answers.
//
// RUN:
//   1. npm install express cors
//   2. Set the environment variable, never commit it in code:
//      AI_API_KEY=your-key  AI_API_URL=https://api.openai.com/v1/chat/completions  AI_MODEL=gemini-3.5-flash
//      (Any OpenAI-compatible API works: change AI_API_URL and AI_MODEL only.)
//   3. node server.js   (then point the chat widget at http://localhost:3000/chat
//      or at the deployed URL, e.g. https://your-app.onrender.com/chat)
// DEPLOY (free tiers exist): Render, Railway, Fly.io, or a Vercel/Netlify serverless
// function wrapping the same /chat handler. The static site alone cannot run this.

const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json({ limit: '32kb' }));

const SYSTEM_PROMPT = require('fs').readFileSync(__dirname + '/SYSTEM_PROMPT.md', 'utf8');

app.post('/chat', async (req, res) => {
  const message = String((req.body && req.body.message) || '').trim().slice(0, 2000);
  if (!message) return res.status(400).json({ error: 'Empty message.' });
  if (!process.env.AI_API_KEY) {
    return res.status(500).json({ error: 'AI_API_KEY is not set on the server.' });
  }
  const history = Array.isArray(req.body.history) ? req.body.history.slice(-10) : [];
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) })),
    { role: 'user', content: message },
  ];
  try {
    const r = await fetch(process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.AI_API_KEY,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gemini-3.5-flash',
        messages,
        temperature: 0.4,
        
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return res.status(502).json({ error: 'AI provider error: ' + t.slice(0, 300) });
    }
    const data = await r.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content : '';
    res.json({ reply: reply || "Sorry, I couldn't answer that right now." });
  } catch (e) {
    res.status(502).json({ error: 'Could not reach the AI provider.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('People\'s Secrets AI chat listening on ' + PORT));

const { GoogleGenerativeAI } = require('@google/generative-ai');
const cache = require('./cache');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL  = 'gemini-1.5-flash';

// ── Per-user daily AI call counter (swap Map→Redis for multi-instance) ────────
const callCounts   = new Map();
const DAILY_LIMIT  = parseInt(process.env.DAILY_AI_LIMIT || '30', 10);

function getDayKey(userId) {
  return `${userId}_${new Date().toISOString().slice(0, 10)}`;
}
function checkLimit(userId) {
  const key = getDayKey(userId);
  const n   = callCounts.get(key) || 0;
  if (n >= DAILY_LIMIT)
    throw Object.assign(
      new Error(`Daily AI limit of ${DAILY_LIMIT} calls reached. Resets at midnight.`),
      { statusCode: 429 }
    );
  callCounts.set(key, n + 1);
}
function getRemainingCalls(userId) {
  const used = callCounts.get(getDayKey(userId)) || 0;
  return Math.max(0, DAILY_LIMIT - used);
}

// ── Exponential-backoff retry ─────────────────────────────────────────────────
async function withRetry(fn, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      const retryable =
        err.message?.includes('503') || err.message?.includes('overloaded') ||
        err.message?.includes('UNAVAILABLE') || err.status === 503;
      if (i === retries || !retryable) throw err;
      await new Promise(r => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

// ── Strip markdown fences Gemini sometimes adds ───────────────────────────────
function cleanJSON(text) {
  return text.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
}

// ── Shared model instance ─────────────────────────────────────────────────────
function model() { return genAI.getGenerativeModel({ model: MODEL }); }

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXPLAIN TOPIC
// ─────────────────────────────────────────────────────────────────────────────
async function explainTopic(userId, context, topic) {
  checkLimit(userId);
  const cacheKey = `explain:${userId}:${topic.slice(0,60)}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const prompt = `You are an expert tutor. Using ONLY the notes below as your source, explain the topic: "${topic}".
Structure your answer clearly with a short intro, key points, and a one-line summary.
If the topic is not covered in the notes, say so explicitly.

=== NOTES ===
${context}`;

  const reply = await withRetry(async () => {
    const r = await model().generateContent(prompt);
    return r.response.text();
  });

  cache.set(cacheKey, reply, 10 * 60 * 1000); // 10 min
  return reply;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GENERATE FLASHCARDS
// ─────────────────────────────────────────────────────────────────────────────
async function generateFlashcards(userId, context, count = 10) {
  checkLimit(userId);
  const cacheKey = `fc:${userId}:${count}:${context.slice(0,80)}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const prompt = `You are a study assistant. Based on the notes below, generate exactly ${count} flashcards.
Return ONLY a valid JSON array — no markdown, no code fences.
Format: [{"question":"...","answer":"...","difficulty":"easy|medium|hard"}]
Focus on key concepts, definitions, and relationships.

=== NOTES ===
${context}`;

  const cards = await withRetry(async () => {
    const r    = await model().generateContent(prompt);
    const data = JSON.parse(cleanJSON(r.response.text()));
    if (!Array.isArray(data) || !data.length) throw new Error('Bad flashcard response');
    return data.map(c => ({
      question:   String(c.question  || '').slice(0, 1000),
      answer:     String(c.answer    || '').slice(0, 2000),
      difficulty: ['easy','medium','hard'].includes(c.difficulty) ? c.difficulty : 'medium',
    }));
  });

  cache.set(cacheKey, cards, 5 * 60 * 1000);
  return cards;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. GENERATE QUIZ
// ─────────────────────────────────────────────────────────────────────────────
async function generateQuiz(userId, context, count = 5) {
  checkLimit(userId);

  const prompt = `You are a teacher. Based on the notes below, create exactly ${count} multiple-choice questions.
Return ONLY a valid JSON array — no markdown, no code fences.
Format: [{"question":"...","options":["A","B","C","D"],"correctAnswer":"full option text"}]
Rules: 4 options each; correctAnswer must match one option exactly.

=== NOTES ===
${context}`;

  return await withRetry(async () => {
    const r    = await model().generateContent(prompt);
    const data = JSON.parse(cleanJSON(r.response.text()));
    if (!Array.isArray(data) || !data.length) throw new Error('Bad quiz response');
    return data.map(q => ({
      question:      String(q.question     || '').slice(0, 1000),
      options:       Array.isArray(q.options) ? q.options.slice(0,4).map(o=>String(o).slice(0,500)) : [],
      correctAnswer: String(q.correctAnswer || '').slice(0, 500),
    }));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. RAG CHAT  (free-form Q&A grounded in retrieved chunks)
// ─────────────────────────────────────────────────────────────────────────────
async function ragChat(userId, context, question, history = []) {
  checkLimit(userId);

  const systemPrompt = `You are StudyOS AI Tutor. Answer the student's question using ONLY the note excerpts below as your source.
Cite which source you used (e.g. "According to your ${'"'}Photosynthesis${'"'} notes...").
If the answer is not in the notes, say so and offer general guidance.

=== RETRIEVED NOTE EXCERPTS ===
${context}`;

  const chatHistory = [
    { role: 'user',  parts: [{ text: systemPrompt }] },
    { role: 'model', parts: [{ text: 'Understood. I will only answer based on your notes. What would you like to know?' }] },
    ...history.slice(-10).map(m => ({ role: m.role, parts: [{ text: m.text }] })),
  ];

  return await withRetry(async () => {
    const chat   = model().startChat({ history: chatHistory });
    const result = await chat.sendMessage(question);
    return result.response.text();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SUMMARISE NOTE
// ─────────────────────────────────────────────────────────────────────────────
async function summariseNote(userId, context, noteTitle) {
  checkLimit(userId);
  const cacheKey = `summary:${userId}:${noteTitle.slice(0,60)}`;
  const cached   = cache.get(cacheKey);
  if (cached) return cached;

  const prompt = `Summarise the following study notes on "${noteTitle}" in 3–5 bullet points.
Be concise. Each bullet = one key concept or fact. No fluff.

=== NOTES ===
${context}`;

  const reply = await withRetry(async () => {
    const r = await model().generateContent(prompt);
    return r.response.text();
  });

  cache.set(cacheKey, reply, 15 * 60 * 1000);
  return reply;
}

module.exports = {
  generateFlashcards,
  generateQuiz,
  ragChat,
  explainTopic,
  summariseNote,
  getRemainingCalls,
};

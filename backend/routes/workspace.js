/**
 * /api/workspace  — unified AI workspace endpoint
 *
 * Handles all user-chosen actions in one route:
 *   explain   → explain a topic grounded in the note(s)
 *   flashcards → generate & save flashcards
 *   quiz       → generate quiz questions
 *   summarise  → bullet-point summary of a note
 *   chat       → free-form RAG Q&A (single or cross-note)
 *
 * Every response is stored in ChatSession for persistent history.
 */

const express     = require('express');
const rateLimit   = require('express-rate-limit');
const Note        = require('../models/Note');
const Flashcard   = require('../models/Flashcard');
const ChatSession = require('../models/ChatSession');
const { protect } = require('../middleware/auth');
const {
  generateFlashcards, generateQuiz,
  ragChat, explainTopic, summariseNote,
  getRemainingCalls,
} = require('../utils/gemini');
const { retrieve, buildContext } = require('../utils/rag');

const router = express.Router();

// Slightly stricter rate limit on the AI workspace
const workspaceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many AI requests. Please wait a moment.' },
});

// ── Helper: get or create a session ──────────────────────────────────────────
async function getOrCreateSession(userId, noteId) {
  const scope = noteId ? 'note' : 'global';
  let session = await ChatSession.findOne({
    user: userId,
    note: noteId || null,
    scope,
  });
  if (!session) {
    session = await ChatSession.create({ user: userId, note: noteId || null, scope });
  }
  return session;
}

// ── Helper: get note content safely ──────────────────────────────────────────
async function getNoteContent(noteId, userId) {
  const note = await Note.findOne({ _id: noteId, user: userId });
  if (!note) throw Object.assign(new Error('Note not found'), { statusCode: 404 });
  const content = note.extractedText || note.textContent || '';
  if (content.length < 30)
    throw Object.assign(new Error('Note has too little content to work with'), { statusCode: 400 });
  return { note, content };
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/workspace/action
// Body: { action, noteId?, noteIds?, topic?, count?, message?, history? }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/action', protect, workspaceLimiter, async (req, res) => {
  const { action, noteId, noteIds, topic, count, message } = req.body;
  const userId = String(req.user._id);

  if (!action) return res.status(400).json({ error: 'action is required' });

  try {
    let responsePayload = {};
    const session = await getOrCreateSession(userId, noteId || null);

    // ── EXPLAIN ───────────────────────────────────────────────────────────────
    if (action === 'explain') {
      if (!noteId || !topic)
        return res.status(400).json({ error: 'noteId and topic are required for explain' });

      const { note, content } = await getNoteContent(noteId, userId);
      // Use RAG: retrieve the most relevant chunks about this topic
      const chunks   = await retrieve(userId, topic, noteId);
      const context  = chunks.length ? buildContext(chunks) : content.slice(0, 8000);
      const reply    = await explainTopic(userId, context, topic);

      responsePayload = { action: 'explain', topic, reply };

      session.messages.push({ role: 'user',  text: `Explain: ${topic}`, action: 'explain', metadata: { topic } });
      session.messages.push({ role: 'model', text: reply, action: 'explain' });
    }

    // ── SUMMARISE ─────────────────────────────────────────────────────────────
    else if (action === 'summarise') {
      if (!noteId) return res.status(400).json({ error: 'noteId is required for summarise' });
      const { note, content } = await getNoteContent(noteId, userId);
      const reply = await summariseNote(userId, content.slice(0, 8000), note.title);

      responsePayload = { action: 'summarise', reply, noteTitle: note.title };
      session.messages.push({ role: 'user',  text: `Summarise my notes on "${note.title}"`, action: 'summarise' });
      session.messages.push({ role: 'model', text: reply, action: 'summarise' });
    }

    // ── FLASHCARDS ────────────────────────────────────────────────────────────
    else if (action === 'flashcards') {
      if (!noteId) return res.status(400).json({ error: 'noteId is required for flashcards' });
      const { note, content } = await getNoteContent(noteId, userId);
      const cardCount = Math.min(Math.max(parseInt(count) || 10, 1), 20);
      const cards     = await generateFlashcards(userId, content, cardCount);

      await Flashcard.deleteMany({ note: noteId, user: userId });
      const saved = await Flashcard.insertMany(
        cards.map(c => ({ ...c, user: userId, note: noteId }))
      );

      const confirmMsg = `Generated ${saved.length} flashcards for "${note.title}". Open the Flashcards tab to review them.`;
      responsePayload = { action: 'flashcards', count: saved.length, flashcards: saved, message: confirmMsg };

      session.messages.push({ role: 'user',  text: `Generate ${cardCount} flashcards for "${note.title}"`, action: 'flashcards', metadata: { count: cardCount } });
      session.messages.push({ role: 'model', text: confirmMsg, action: 'flashcards', metadata: { count: saved.length } });
    }

    // ── QUIZ ──────────────────────────────────────────────────────────────────
    else if (action === 'quiz') {
      if (!noteId) return res.status(400).json({ error: 'noteId is required for quiz' });
      const { note, content } = await getNoteContent(noteId, userId);
      const qCount    = Math.min(Math.max(parseInt(count) || 5, 1), 15);
      const questions = await generateQuiz(userId, content, qCount);

      const confirmMsg = `Generated a ${questions.length}-question quiz for "${note.title}". Opening it now...`;
      responsePayload = { action: 'quiz', questions, noteId, message: confirmMsg };

      session.messages.push({ role: 'user',  text: `Quiz me on "${note.title}" with ${qCount} questions`, action: 'quiz' });
      session.messages.push({ role: 'model', text: confirmMsg, action: 'quiz', metadata: { count: questions.length } });
    }

    // ── CHAT (RAG Q&A — single note or cross-note) ────────────────────────────
    else if (action === 'chat') {
      if (!message) return res.status(400).json({ error: 'message is required for chat' });

      // Determine search scope
      const searchNoteId = noteId || null; // null = global search across all user notes

      const chunks  = await retrieve(userId, message, searchNoteId);
      const context = buildContext(chunks);

      // Pass last 10 messages as history
      const history = session.messages.slice(-10).map(m => ({ role: m.role, text: m.text }));
      const reply   = await ragChat(userId, context, message, history);

      // Surface which notes were used
      const sourceTitles = [...new Set(chunks.map(c => c.noteTitle))];

      responsePayload = {
        action: 'chat', reply,
        sources: sourceTitles,
        chunksUsed: chunks.length,
      };

      session.messages.push({ role: 'user',  text: message, action: 'chat' });
      session.messages.push({ role: 'model', text: reply,   action: 'chat', metadata: { sources: sourceTitles } });
    }

    else {
      return res.status(400).json({ error: `Unknown action: ${action}` });
    }

    // Cap session history at 100 messages to keep it lean
    if (session.messages.length > 100) {
      session.messages = session.messages.slice(-100);
    }
    await session.save();

    res.json({
      ...responsePayload,
      remainingCalls: getRemainingCalls(userId),
      sessionId: session._id,
    });
  } catch (err) {
    console.error(`[workspace/${action}]`, err.message);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'AI action failed' });
  }
});

// ── GET /api/workspace/history?noteId=  — load chat history for a note/global ──
router.get('/history', protect, async (req, res) => {
  try {
    const { noteId } = req.query;
    const session = await ChatSession.findOne({
      user: req.user._id,
      note: noteId || null,
    });
    res.json({ messages: session?.messages || [], sessionId: session?._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// ── DELETE /api/workspace/history?noteId=  — clear history ───────────────────
router.delete('/history', protect, async (req, res) => {
  try {
    const { noteId } = req.query;
    await ChatSession.findOneAndUpdate(
      { user: req.user._id, note: noteId || null },
      { messages: [] }
    );
    res.json({ message: 'History cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// ── GET /api/workspace/notes-with-chunks — notes the user can RAG against ─────
router.get('/notes-with-chunks', protect, async (req, res) => {
  try {
    const Chunk = require('../models/Chunk');
    const noteIds = await Chunk.distinct('note', { user: req.user._id });
    const notes   = await Note.find({ _id: { $in: noteIds }, user: req.user._id })
      .select('title subject createdAt')
      .sort({ createdAt: -1 });
    res.json({ notes, remainingCalls: getRemainingCalls(String(req.user._id)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

module.exports = router;

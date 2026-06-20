const express   = require('express');
const Note      = require('../models/Note');
const Flashcard = require('../models/Flashcard');
const { protect }            = require('../middleware/auth');
const { generateFlashcards } = require('../utils/gemini');

const router = express.Router();

// POST /api/flashcards/generate/:noteId
router.post('/generate/:noteId', protect, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.noteId, user: req.user._id });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const content = note.extractedText || note.textContent || '';
    if (content.length < 50)
      return res.status(400).json({ error: 'Note has too little content' });

    const count = Math.min(Math.max(parseInt(req.body.count) || 10, 1), 20);
    const cards = await generateFlashcards(String(req.user._id), content, count);

    await Flashcard.deleteMany({ note: note._id, user: req.user._id });
    const flashcards = await Flashcard.insertMany(
      cards.map(c => ({ ...c, user: req.user._id, note: note._id }))
    );
    res.json({ flashcards, count: flashcards.length });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Failed to generate flashcards' });
  }
});

// GET /api/flashcards/:noteId
router.get('/:noteId', protect, async (req, res) => {
  try {
    const flashcards = await Flashcard.find({ note: req.params.noteId, user: req.user._id });
    res.json({ flashcards });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch flashcards' });
  }
});

// PATCH /api/flashcards/:id/review
router.patch('/:id/review', protect, async (req, res) => {
  try {
    const card = await Flashcard.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $inc: { timesReviewed: 1 }, lastReviewed: new Date() },
      { new: true }
    );
    if (!card) return res.status(404).json({ error: 'Flashcard not found' });
    await req.user.updateOne({ $inc: { totalFlashcardsReviewed: 1 } });
    res.json({ card });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update flashcard' });
  }
});

module.exports = router;

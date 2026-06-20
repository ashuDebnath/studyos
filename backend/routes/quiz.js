const express     = require('express');
const Note        = require('../models/Note');
const QuizResult  = require('../models/QuizResult');
const { protect } = require('../middleware/auth');
const { generateQuiz } = require('../utils/gemini');

const router = express.Router();

// POST /api/quiz/generate/:noteId
router.post('/generate/:noteId', protect, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.noteId, user: req.user._id });
    if (!note) return res.status(404).json({ error: 'Note not found' });
    const content = note.extractedText || note.textContent || '';
    if (content.length < 50) return res.status(400).json({ error: 'Note has too little content' });

    const count     = Math.min(Math.max(parseInt(req.body.count) || 5, 1), 15);
    const questions = await generateQuiz(String(req.user._id), content, count);
    res.json({ questions, noteId: note._id });
  } catch (err) {
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.message || 'Failed to generate quiz' });
  }
});

// POST /api/quiz/submit
router.post('/submit', protect, async (req, res) => {
  try {
    const { noteId, questions, userAnswers } = req.body;
    if (!noteId || !Array.isArray(questions) || !userAnswers)
      return res.status(400).json({ error: 'Invalid payload' });

    const scored = questions.map((q, i) => ({
      question:      q.question,
      options:       q.options,
      correctAnswer: q.correctAnswer,
      userAnswer:    userAnswers[i] || '',
      isCorrect:     userAnswers[i] === q.correctAnswer,
    }));

    const score      = scored.filter(q => q.isCorrect).length;
    const percentage = Math.round((score / questions.length) * 100);

    const quizResult = await QuizResult.create({
      user: req.user._id, note: noteId,
      score, total: questions.length, percentage, questions: scored,
    });
    await req.user.updateOne({ $inc: { totalQuizzesTaken: 1 } });
    res.json({ quizResult, score, total: questions.length, percentage });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit quiz' });
  }
});

// GET /api/quiz/results
router.get('/results', protect, async (req, res) => {
  try {
    const results = await QuizResult.find({ user: req.user._id })
      .populate('note', 'title subject')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

module.exports = router;

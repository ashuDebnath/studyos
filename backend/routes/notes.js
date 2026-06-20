const express   = require('express');
const pdfParse  = require('pdf-parse');
const axios     = require('axios');
const validator = require('validator');
const Note      = require('../models/Note');
const Chunk     = require('../models/Chunk');
const Flashcard = require('../models/Flashcard');
const { protect }          = require('../middleware/auth');
const { upload, cloudinary } = require('../middleware/upload');
const { indexNote }          = require('../utils/rag');
const cache                  = require('../utils/cache');

const router = express.Router();

async function extractTextFromUrl(fileUrl) {
  try {
    const res    = await axios.get(fileUrl, { responseType: 'arraybuffer', timeout: 20000 });
    const buffer = Buffer.from(res.data);
    const data   = await pdfParse(buffer);
    return data.text.replace(/\s+/g, ' ').trim().slice(0, 20000);
  } catch (err) {
    console.error('[notes] PDF extraction error:', err.message);
    return '';
  }
}

// POST /api/notes  — upload PDF
router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'PDF file is required' });
    const title   = validator.escape((req.body.title || req.file.originalname.replace(/\.pdf$/i,'')).slice(0,200));
    const subject = validator.escape((req.body.subject || 'General').slice(0,100));

    const extractedText = await extractTextFromUrl(req.file.path);

    const note = await Note.create({
      user: req.user._id, title, subject,
      fileUrl: req.file.path, publicId: req.file.filename,
      extractedText, fileType: 'pdf',
    });

    // Index for RAG (non-blocking)
    indexNote(note).catch(e => console.error('[rag] index error:', e.message));

    cache.delPrefix(`notes:${req.user._id}`);
    res.status(201).json({ note });
  } catch (err) {
    console.error('[notes/upload]', err.message);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// POST /api/notes/text  — plain text note
router.post('/text', protect, async (req, res) => {
  try {
    const { textContent } = req.body;
    const title   = validator.escape((req.body.title   || '').slice(0,200));
    const subject = validator.escape((req.body.subject || 'General').slice(0,100));
    if (!title || !textContent) return res.status(400).json({ error: 'Title and content are required' });

    const note = await Note.create({
      user: req.user._id, title, subject,
      extractedText: textContent.slice(0, 20000),
      textContent: textContent.slice(0, 50000),
      fileType: 'text',
    });

    indexNote(note).catch(e => console.error('[rag] index error:', e.message));
    cache.delPrefix(`notes:${req.user._id}`);
    res.status(201).json({ note });
  } catch (err) {
    console.error('[notes/text]', err.message);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// GET /api/notes
router.get('/', protect, async (req, res) => {
  try {
    const cacheKey = `notes:${req.user._id}`;
    const cached   = cache.get(cacheKey);
    if (cached) return res.json({ notes: cached, cached: true });

    const notes = await Note.find({ user: req.user._id })
      .select('-extractedText -textContent')
      .sort({ createdAt: -1 });

    cache.set(cacheKey, notes, 60 * 1000); // 1 min
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const cacheKey = `note:${req.params.id}`;
    const cached   = cache.get(cacheKey);
    if (cached) return res.json({ note: cached });

    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    cache.set(cacheKey, note, 5 * 60 * 1000);
    res.json({ note });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    if (note.publicId) {
      await cloudinary.uploader.destroy(note.publicId, { resource_type: 'raw' }).catch(()=>{});
    }
    await Promise.all([
      note.deleteOne(),
      Chunk.deleteMany({ note: note._id }),
      Flashcard.deleteMany({ note: note._id }),
    ]);

    cache.del(`note:${note._id}`);
    cache.delPrefix(`notes:${req.user._id}`);
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;

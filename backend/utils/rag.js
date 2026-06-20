/**
 * Modern Vector RAG — StudyOS
 *
 * Pipeline:
 *   Upload PDF/Text
 *     → Extract text
 *     → Split into 400-word overlapping chunks
 *     → Embed each chunk  (Google text-embedding-004, 768 dims)
 *     → Store chunk + embedding in MongoDB "chunks" collection
 *
 *   User query
 *     → Embed query  (same model, same space)
 *     → $vectorSearch in MongoDB Atlas (cosine similarity, top-K candidates)
 *     → Build context string from top-K chunks
 *     → Feed context + query to Gemini → grounded answer
 *
 * Replaced:
 *   ✗  tokenise / STOP_WORDS / BM25-lite scoreChunk
 *   ✗  keywords [] field in Chunk documents
 *   ✗  Chunk.find({ keywords: { $in: queryTokens } }) keyword pre-filter
 *
 * Added:
 *   ✓  embedText()           — Google Generative AI embedContent()
 *   ✓  embedChunksSerially() — rate-limit-safe serial embedding
 *   ✓  $vectorSearch         — MongoDB Atlas Vector Search aggregation stage
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
const Chunk    = require('../models/Chunk');

// ── Config ────────────────────────────────────────────────────────────────────
const CHUNK_SIZE    = 400;               // words per chunk
const CHUNK_OVERLAP = 60;               // overlapping words between consecutive chunks
const TOP_K         = 5;               // chunks returned to the LLM
const EMBED_MODEL   = 'text-embedding-004'; // 768-dim, best free Google embedding
const ATLAS_INDEX   = 'chunk_vector_index'; // name of your Atlas Vector Search index
const EMBED_API_DELAY_MS = 120;         // ms between embedding calls (stay < 1 500 req/min)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Embedding ─────────────────────────────────────────────────────────────────

/**
 * Generate a 768-dim embedding vector for a text string.
 * Trims to 8 192 chars so we never exceed the model's token limit.
 */
async function embedText(text) {
  const model  = genAI.getGenerativeModel({ model: EMBED_MODEL });
  const result = await model.embedContent(text.slice(0, 8192));
  return result.embedding.values; // number[], length 768
}

/**
 * Embed an array of texts one-by-one with a small delay between calls.
 * This keeps us well under the free-tier rate limit (1 500 req/min).
 */
async function embedChunksSerially(texts) {
  const embeddings = [];
  for (const text of texts) {
    embeddings.push(await embedText(text));
    if (texts.length > 1) {
      await new Promise((r) => setTimeout(r, EMBED_API_DELAY_MS));
    }
  }
  return embeddings;
}

// ── Chunking ──────────────────────────────────────────────────────────────────

/**
 * Split raw text into overlapping word-windows.
 * Overlap ensures sentences that straddle a boundary appear in both chunks.
 */
function splitIntoChunks(text) {
  const words  = text.split(/\s+/);
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + CHUNK_SIZE).join(' '));
    i += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// ── Indexing ──────────────────────────────────────────────────────────────────

/**
 * Chunk a note, embed every chunk, and upsert into the Chunk collection.
 * Called non-blocking from notes.js after a note is saved.
 *
 * @param {Object} note  — Mongoose Note document
 * @returns {number}     — number of chunks written
 */
async function indexNote(note) {
  const content = note.extractedText || note.textContent || '';
  if (!content || content.length < 30) return 0;

  // Wipe old chunks so re-indexing is idempotent
  await Chunk.deleteMany({ note: note._id });

  const rawChunks  = splitIntoChunks(content);
  const embeddings = await embedChunksSerially(rawChunks);

  const docs = rawChunks.map((text, idx) => ({
    user:        note.user,
    note:        note._id,
    noteTitle:   note.title,
    noteSubject: note.subject,
    chunkIndex:  idx,
    text,
    embedding:   embeddings[idx],
  }));

  await Chunk.insertMany(docs, { ordered: false });
  return docs.length;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────

/**
 * Embed the query, then run $vectorSearch on MongoDB Atlas to retrieve
 * the TOP_K most semantically similar chunks.
 *
 * The Atlas index (chunk_vector_index) must include:
 *   - "embedding" as the vector field  (cosine, 768 dims)
 *   - "user"  as a filter field
 *   - "note"  as a filter field
 *
 * @param {string}      userId
 * @param {string}      query    — natural-language question
 * @param {string|null} noteId   — null = search across ALL user notes
 * @returns {Array<{text, noteTitle, noteSubject, score}>}
 */
async function retrieve(userId, query, noteId = null) {
  // 1. Embed the query into the same vector space as the stored chunks
  const queryVector = await embedText(query);

  // 2. Build the pre-filter (Atlas evaluates this BEFORE ANN search)
  const filter = {
    user: { $eq: new mongoose.Types.ObjectId(String(userId)) },
  };
  if (noteId) {
    filter.note = { $eq: new mongoose.Types.ObjectId(String(noteId)) };
  }

  // 3. $vectorSearch — Approximate Nearest Neighbour over cosine distance
  const pipeline = [
    {
      $vectorSearch: {
        index:         ATLAS_INDEX,
        path:          'embedding',       // field holding the 768-dim vectors
        queryVector,                      // our freshly-embedded query
        numCandidates: TOP_K * 15,        // wider pool → better recall
        limit:         TOP_K,             // final number of chunks returned
        filter,                           // pre-filter by user (+ optional note)
      },
    },
    {
      // Project only what we need; drop the large embedding array
      $project: {
        _id:         1,
        text:        1,
        noteTitle:   1,
        noteSubject: 1,
        chunkIndex:  1,
        note:        1,
        score: { $meta: 'vectorSearchScore' }, // cosine similarity (0 – 1)
      },
    },
  ];

  return await Chunk.aggregate(pipeline);
}

// ── Context builder ───────────────────────────────────────────────────────────

/**
 * Assemble retrieved chunks into a single context string for the LLM prompt.
 */
function buildContext(chunks) {
  if (!chunks.length) return 'No relevant content found in your notes.';
  return chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: "${c.noteTitle}" – ${c.noteSubject} | similarity: ${
          c.score != null ? c.score.toFixed(3) : 'n/a'
        }]\n${c.text}`
    )
    .join('\n\n---\n\n');
}

module.exports = { indexNote, retrieve, buildContext };

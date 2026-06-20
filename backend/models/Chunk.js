const mongoose = require("mongoose");

/**
 * Each Note is split into overlapping chunks of ~400 words.
 * Each chunk is embedded with Google text-embedding-004 (768 dims)
 * and stored here. Retrieval happens via MongoDB Atlas Vector Search
 * ($vectorSearch aggregation) — cosine similarity over the embedding field.
 *
 * ⚠️  You must create the Atlas Vector Search index manually before RAG works.
 *     See README.md → "MongoDB Atlas Vector Search Setup".
 */
const chunkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      required: true,
      index: true,
    },
    noteTitle: { type: String },
    noteSubject: { type: String },
    chunkIndex: { type: Number, required: true }, // position within parent note
    text: { type: String, required: true }, // raw chunk text shown in context
    embedding: { type: [Number], required: true }, // 768-dim float vector (text-embedding-004)
  },
  { timestamps: true },
);

// Standard compound indexes for non-vector queries
chunkSchema.index({ note: 1, chunkIndex: 1 }); // ordered chunk fetch for a note
chunkSchema.index({ user: 1 }); // delete-all-user-chunks

// The $vectorSearch index ("chunk_vector_index") is defined in Atlas UI — NOT here.
// Mongoose indexes only cover regular MongoDB indexes.

module.exports = mongoose.model("Chunk", chunkSchema);

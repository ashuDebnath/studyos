const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "model"], required: true },
    text: { type: String, required: true, maxlength: 8000 },
    action: { type: String }, // 'explain' | 'flashcards' | 'quiz' | 'chat' | 'rag'
    metadata: { type: mongoose.Schema.Types.Mixed }, // e.g. { topic, cardCount }
  },
  { _id: false, timestamps: true },
);

const chatSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: mongoose.Schema.Types.ObjectId, ref: "Note", default: null }, // null = global RAG session
    scope: { type: String, enum: ["note", "global"], default: "note" },
    messages: { type: [messageSchema], default: [] },
    // Keep sessions lean — hard cap at 100 messages
  },
  { timestamps: true },
);

chatSessionSchema.index({ user: 1, note: 1 });
chatSessionSchema.index({ user: 1, scope: 1 });

module.exports = mongoose.model("ChatSession", chatSessionSchema);

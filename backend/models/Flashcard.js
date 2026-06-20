const mongoose = require("mongoose");

const flashcardSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      required: true,
      index: true,
    },
    question: { type: String, required: true, maxlength: 1000 },
    answer: { type: String, required: true, maxlength: 2000 },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    timesReviewed: { type: Number, default: 0 },
    lastReviewed: { type: Date },
  },
  { timestamps: true },
);

// Fetch all flashcards for a note + filter by owner
flashcardSchema.index({ note: 1, user: 1 });

module.exports = mongoose.model("Flashcard", flashcardSchema);

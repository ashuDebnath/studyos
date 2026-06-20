const mongoose = require("mongoose");

const quizResultSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    percentage: { type: Number, required: true },
    questions: [
      {
        question: { type: String, maxlength: 1000 },
        options: [{ type: String, maxlength: 500 }],
        correctAnswer: { type: String, maxlength: 500 },
        userAnswer: { type: String, maxlength: 500 },
        isCorrect: Boolean,
      },
    ],
  },
  { timestamps: true },
);

// Fetch quiz history for a user, newest first
quizResultSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("QuizResult", quizResultSchema);

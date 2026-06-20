const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    subject: { type: String, trim: true, default: "General", maxlength: 100 },
    fileUrl: { type: String },
    publicId: { type: String },
    extractedText: { type: String },
    fileType: { type: String, enum: ["pdf", "text"], default: "pdf" },
    textContent: { type: String, maxlength: 50000 },
  },
  { timestamps: true },
);

// Compound index: most common query — all notes for a user, newest first
noteSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Note", noteSchema);

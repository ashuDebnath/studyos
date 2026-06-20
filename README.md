# StudyOS — AI-Powered Learning Workspace

A full-stack MERN application where students upload notes/PDFs and use Google Gemini AI to auto-generate flashcards, MCQ quizzes, and get answers from an AI tutor powered by **vector RAG**.

## Tech Stack

- **Frontend**: React, React Router, Axios, react-hot-toast
- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas (with Vector Search)
- **AI / Embeddings**: Google Gemini 1.5 Flash + text-embedding-004
- **File Storage**: Cloudinary
- **Auth**: JWT + bcrypt

## Features

- User registration & login with JWT auth
- Upload PDF notes or write text notes
- AI-generated flashcards (flip card UI)
- AI-generated MCQ quizzes with instant scoring
- AI Tutor chat — semantically-grounded answers via vector RAG
- Global RAG — ask questions across all your notes at once
- Study streak tracking and quiz history

## RAG Architecture (v3 — Vector RAG)

```
Upload PDF / Text
      ↓
Extract text (pdf-parse)
      ↓
Split into 400-word overlapping chunks
      ↓
Embed each chunk → Google text-embedding-004 (768-dim float vector)
      ↓
Store { text, embedding, user, note, … } in MongoDB "chunks" collection
      ↓
──────────────── Query time ────────────────
User asks a question
      ↓
Embed query → same 768-dim space
      ↓
$vectorSearch on MongoDB Atlas
  (cosine ANN over "embedding", pre-filtered by user/note)
      ↓
Top-5 most semantically similar chunks returned
      ↓
Build context string with source citations + similarity scores
      ↓
Feed context + question to Gemini 1.5 Flash
      ↓
Grounded answer → stored in ChatSession
```

> **StudyOS** — Full-stack EdTech platform (React, Node.js, Express, MongoDB Atlas) with Google Gemini AI and vector RAG. Implements semantic search via MongoDB Atlas Vector Search and Google text-embedding-004 embeddings, replacing keyword BM25 retrieval with cosine ANN similarity. Features PDF upload, AI-generated flashcards and MCQ quizzes, a context-aware AI tutor, JWT auth, Cloudinary storage, and a progress dashboard. Deployed on Vercel + Render.

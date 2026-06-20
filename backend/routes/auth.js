const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ── Strict rate limiter for auth endpoints ────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 10,                      // max 10 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait 15 minutes and try again.' },
  skipSuccessfulRequests: true, // don't count successful logins against the limit
});

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Input validation
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });
    if (!validator.isEmail(email))
      return res.status(400).json({ error: 'Invalid email address' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (name.trim().length < 2)
      return res.status(400).json({ error: 'Name must be at least 2 characters' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(400).json({ error: 'Email already registered' });

    const user = await User.create({
      name: validator.escape(name.trim()),
      email: email.toLowerCase(),
      password,
    });

    res.status(201).json({
      token: generateToken(user._id),
      user: { id: user._id, name: user.name, email: user.email, streak: user.streak },
    });
  } catch (err) {
    console.error('[register]', err.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: 'Email and password are required' });
    if (!validator.isEmail(email))
      return res.status(400).json({ error: 'Invalid email address' });

    const user = await User.findOne({ email: email.toLowerCase() });
    // Constant-time comparison: always run comparePassword to prevent timing attacks
    const isMatch = user ? await user.comparePassword(password) : false;
    if (!user || !isMatch)
      return res.status(401).json({ error: 'Invalid email or password' });

    // Update study streak
    const today = new Date();
    const last = user.lastStudied;
    if (last) {
      const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) user.streak += 1;
      else if (diffDays > 1) user.streak = 1;
      // diffDays === 0: same day login, don't change streak
    } else {
      user.streak = 1;
    }
    user.lastStudied = today;
    await user.save();

    res.json({
      token: generateToken(user._id),
      user: { id: user._id, name: user.name, email: user.email, streak: user.streak },
    });
  } catch (err) {
    console.error('[login]', err.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me — verify token and return user
router.get('/me', protect, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;

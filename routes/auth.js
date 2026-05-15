const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const RefreshToken = require('../models/refreshToken');

const {
  hashToken,
  createJti,
  signAccessToken,
  signRefreshToken,
  persistRefreshToken,
  rotateRefreshToken,
  getRefreshCookieOptions,
  setRefreshCookie,
} = require('../utils/token');

const router = express.Router();

function ensureJwtSecrets() {
  return Boolean(process.env.JWT_SECRET && process.env.REFRESH_TOKEN_SECRET);
}

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name || '',
    username: user.username,
    email: user.email,
  };
}

async function issueTokens(user, req, res) {
  const accessToken = signAccessToken(user);

  const jti = createJti();
  const refreshToken = signRefreshToken(user, jti);

  await persistRefreshToken({
    user,
    refreshToken,
    jti,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
  });

  setRefreshCookie(res, refreshToken);
  return { accessToken };
}

// Register + auto-login (sets refresh cookie)
router.post('/register', async (req, res) => {
  try {
    if (!ensureJwtSecrets()) {
      return res.status(500).json({ message: 'JWT secrets are not configured' });
    }

    const { name = '', username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email, and password are required' });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, username, email, password: hashedPassword });
    await newUser.save();

    const { accessToken } = await issueTokens(newUser, req, res);

    res.status(201).json({ accessToken, user: safeUser(newUser) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login (sets refresh cookie)
router.post('/login', async (req, res) => {
  try {
    if (!ensureJwtSecrets()) {
      return res.status(500).json({ message: 'JWT secrets are not configured' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const { accessToken } = await issueTokens(user, req, res);

    res.json({ accessToken, user: safeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Reads the refresh cookie, verifies it, checks the DB entry, and rotates it.
router.post('/refresh', async (req, res) => {
  try {
    if (!ensureJwtSecrets()) {
      return res.status(500).json({ message: 'JWT secrets are not configured' });
    }

    const token = req.cookies?.refresh_token;
    if (!token) return res.status(401).json({ message: 'No refresh token' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError' ? 'Refresh token expired' : 'Invalid refresh token';
      return res.status(401).json({ message });
    }

    const tokenHash = hashToken(token);
    const doc = await RefreshToken.findOne({ tokenHash, jti: decoded.jti }).populate('user');

    if (!doc) return res.status(401).json({ message: 'Refresh token not recognized' });
    if (doc.revokedAt) return res.status(401).json({ message: 'Refresh token revoked' });
    if (doc.expiresAt < new Date())
      return res.status(401).json({ message: 'Refresh token expired' });

    const result = await rotateRefreshToken(doc, doc.user, req, res);
    return res.json({ accessToken: result.accessToken });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Logout: revoke the current refresh token (if present) and clear cookie
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies?.refresh_token;

    if (token) {
      const tokenHash = hashToken(token);
      const doc = await RefreshToken.findOne({ tokenHash });
      if (doc && !doc.revokedAt) {
        doc.revokedAt = new Date();
        await doc.save();
      }
    }

    // clearCookie must match the cookie options that were used to set it
    const opts = getRefreshCookieOptions();
    res.clearCookie('refresh_token', {
      httpOnly: opts.httpOnly,
      secure: opts.secure,
      sameSite: opts.sameSite,
      domain: opts.domain,
      path: opts.path,
    });

    res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

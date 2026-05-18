const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/user');

const router = express.Router();

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name || '',
    nickname: user.nickname || '',
    avatarDataUrl: user.avatarDataUrl || '',
    username: user.username,
    email: user.email,
  };
}

function normalizeNickname(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 40);
}

function normalizeAvatarDataUrl(value) {
  const avatar = String(value || '').trim();
  if (!avatar) return '';

  const isSupportedImage = /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(avatar);
  if (!isSupportedImage) {
    const err = new Error('Avatar must be a PNG, JPEG, or WebP image');
    err.status = 400;
    throw err;
  }

  if (avatar.length > 450000) {
    const err = new Error('Avatar image is too large');
    err.status = 400;
    throw err;
  }

  return avatar;
}

router.get('/me', auth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: 'User not authenticated',
      });
    }

    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({
      message: 'Server error',
      error: err.message,
    });
  }
});

router.patch('/me', auth, async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: 'User not authenticated',
      });
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(req.body, 'nickname')) {
      updates.nickname = normalizeNickname(req.body.nickname);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'avatarDataUrl')) {
      updates.avatarDataUrl = normalizeAvatarDataUrl(req.body.avatarDataUrl);
    }

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(err.status || 500).json({
      message: err.status ? err.message : 'Server error',
      error: err.status ? undefined : err.message,
    });
  }
});

module.exports = router;

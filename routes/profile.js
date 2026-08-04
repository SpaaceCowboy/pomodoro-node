const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/user');
const logger = require('../utils/logger');

const router = express.Router();

function safeUser(user) {
  return {
    id: user._id.toString(),
    name: user.name || '',
    nickname: user.nickname || '',
    avatarDataUrl: user.avatarDataUrl || '',
    publicProfileEnabled: Boolean(user.publicProfileEnabled),
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

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }
    res.json({ user: safeUser(user) });
  } catch (err) {
    logger.error({ err }, 'Profile lookup failed');
    res.status(500).json({
      message: 'Server error',
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
    if (Object.prototype.hasOwnProperty.call(req.body, 'publicProfileEnabled')) {
      updates.publicProfileEnabled = Boolean(req.body.publicProfileEnabled);
    }

    const user = await User.updateById(req.user.id, updates);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    res.json({ user: safeUser(user) });
  } catch (err) {
    logger.error({ err }, 'Profile update failed');
    res.status(err.status || 500).json({
      message: err.status ? err.message : 'Server error',
    });
  }
});

module.exports = router;

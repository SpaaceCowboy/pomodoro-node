const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/user');
const Friendship = require('../models/friendship');
const FocusRoom = require('../models/focusRoom');
const { safeUser, getPresenceForUsers } = require('../utils/presence');

const router = express.Router();

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sortPair(a, b) {
  return [a.toString(), b.toString()].sort();
}

function friendshipPairKey(a, b) {
  return sortPair(a, b).join(':');
}

function publicFriendship(doc, viewerId) {
  const requester = doc.requester;
  const recipient = doc.recipient;
  const friend = requester._id.toString() === viewerId ? recipient : requester;
  return {
    id: doc._id.toString(),
    status: doc.status,
    direction: doc.requester._id.toString() === viewerId ? 'outgoing' : 'incoming',
    friend: safeUser(friend),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function findFriendships(userId, status) {
  const query = {
    status,
    $or: [{ requester: userId }, { recipient: userId }],
  };
  return Friendship.find(query)
    .populate('requester', 'name nickname avatarDataUrl username')
    .populate('recipient', 'name nickname avatarDataUrl username')
    .sort({ updatedAt: -1 });
}

router.get('/users/search', auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });

    const regex = new RegExp(escapeRegex(q), 'i');
    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [{ username: regex }, { nickname: regex }, { name: regex }, { email: regex }],
    })
      .select('name nickname avatarDataUrl username')
      .sort({ username: 1 })
      .limit(12)
      .lean();

    res.json({ users: users.map(safeUser) });
  } catch (err) {
    next(err);
  }
});

router.get('/friends', auth, async (req, res, next) => {
  try {
    const viewerId = req.user.id;
    const [accepted, pending] = await Promise.all([
      findFriendships(viewerId, 'accepted'),
      findFriendships(viewerId, 'pending'),
    ]);

    const friendUsers = accepted.map((doc) =>
      doc.requester._id.toString() === viewerId ? doc.recipient : doc.requester
    );
    const feed = await getPresenceForUsers(friendUsers);

    res.json({
      friends: accepted.map((doc) => publicFriendship(doc, viewerId)),
      pending: pending.map((doc) => publicFriendship(doc, viewerId)),
      feed,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/friends/request', auth, async (req, res, next) => {
  try {
    const targetId = String(req.body?.userId || '');
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return res.status(400).json({ message: 'Invalid user' });
    }
    if (targetId === req.user.id) {
      return res.status(400).json({ message: 'You cannot add yourself' });
    }

    const target = await User.findById(targetId).select('_id');
    if (!target) return res.status(404).json({ message: 'User not found' });

    const pairKey = friendshipPairKey(req.user.id, targetId);
    const existing = await Friendship.findOne({ pairKey });

    if (existing) {
      return res.json({ friendship: { id: existing._id.toString(), status: existing.status } });
    }

    const doc = await Friendship.create({
      requester: req.user.id,
      recipient: targetId,
      pairKey,
      status: 'pending',
    });
    res.status(201).json({ friendship: { id: doc._id.toString(), status: doc.status } });
  } catch (err) {
    next(err);
  }
});

router.post('/friends/:id/accept', auth, async (req, res, next) => {
  try {
    const doc = await Friendship.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user.id, status: 'pending' },
      { status: 'accepted' },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Friend request not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/friends/:id', auth, async (req, res, next) => {
  try {
    const doc = await Friendship.findOneAndDelete({
      _id: req.params.id,
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
    });
    if (!doc) return res.status(404).json({ message: 'Friendship not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

function roomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function serializeRoom(room) {
  await room.populate('members.user', 'name nickname avatarDataUrl username');
  const users = room.members.map((member) => member.user).filter(Boolean);
  const presence = await getPresenceForUsers(users);
  return {
    id: room._id.toString(),
    code: room.code,
    name: room.name || '',
    host: room.host.toString(),
    members: presence,
    createdAt: room.createdAt,
  };
}

router.post('/rooms', auth, async (req, res, next) => {
  try {
    const name = String(req.body?.name || '')
      .trim()
      .slice(0, 60);
    let room;
    for (let i = 0; i < 5; i += 1) {
      try {
        room = await FocusRoom.create({
          code: roomCode(),
          name,
          host: req.user.id,
          members: [{ user: req.user.id }],
        });
        break;
      } catch (err) {
        if (err.code !== 11000) throw err;
      }
    }
    if (!room) return res.status(500).json({ message: 'Could not create room' });
    res.status(201).json({ room: await serializeRoom(room) });
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:code/join', auth, async (req, res, next) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase();
    const room = await FocusRoom.findOne({ code, active: true });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    if (!room.members.some((member) => member.user.toString() === req.user.id)) {
      room.members.push({ user: req.user.id });
      await room.save();
    }
    res.json({ room: await serializeRoom(room) });
  } catch (err) {
    next(err);
  }
});

router.get('/rooms/:code', auth, async (req, res, next) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase();
    const room = await FocusRoom.findOne({ code, active: true });
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (!room.members.some((member) => member.user.toString() === req.user.id)) {
      return res.status(403).json({ message: 'Join this room first' });
    }
    res.json({ room: await serializeRoom(room) });
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:code/leave', auth, async (req, res, next) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase();
    const room = await FocusRoom.findOne({ code, active: true });
    if (!room) return res.status(404).json({ message: 'Room not found' });

    room.members = room.members.filter((member) => member.user.toString() !== req.user.id);
    if (!room.members.length) room.active = false;
    await room.save();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

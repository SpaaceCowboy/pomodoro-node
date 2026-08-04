const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/user');
const Friendship = require('../models/friendship');
const FocusRoom = require('../models/focusRoom');
const { safeUser, getPresenceForUsers } = require('../utils/presence');
const { generateRoomCode } = require('../utils/roomCode');

const router = express.Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sortPair(a, b) {
  return [String(a), String(b)].sort();
}

function friendshipPairKey(a, b) {
  return sortPair(a, b).join(':');
}

function publicFriendship(doc, viewerId) {
  const requester = doc.requester;
  const recipient = doc.recipient;
  const outgoing = requester._id === viewerId;
  return {
    id: doc._id,
    status: doc.status,
    direction: outgoing ? 'outgoing' : 'incoming',
    friend: safeUser(outgoing ? recipient : requester),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

router.get('/users/search', auth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });
    const users = await User.search(q, req.user.id, 12);
    return res.json({ users: users.map(safeUser) });
  } catch (err) {
    return next(err);
  }
});

router.get('/friends', auth, async (req, res, next) => {
  try {
    const viewerId = req.user.id;
    const [accepted, pending] = await Promise.all([
      Friendship.listForUser(viewerId, 'accepted'),
      Friendship.listForUser(viewerId, 'pending'),
    ]);

    const friendUsers = accepted.map((doc) =>
      doc.requester._id === viewerId ? doc.recipient : doc.requester
    );
    const feed = await getPresenceForUsers(friendUsers);

    return res.json({
      friends: accepted.map((doc) => publicFriendship(doc, viewerId)),
      pending: pending.map((doc) => publicFriendship(doc, viewerId)),
      feed,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/friends/request', auth, async (req, res, next) => {
  try {
    const targetId = String(req.body?.userId || '');
    if (!UUID_PATTERN.test(targetId)) return res.status(400).json({ message: 'Invalid user' });
    if (targetId === req.user.id) {
      return res.status(400).json({ message: 'You cannot add yourself' });
    }

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: 'User not found' });

    const pairKey = friendshipPairKey(req.user.id, targetId);
    const existing = await Friendship.findByPairKey(pairKey);
    if (existing) {
      return res.json({ friendship: { id: existing._id, status: existing.status } });
    }

    const doc = await Friendship.create({
      requester: req.user.id,
      recipient: targetId,
      pairKey,
      status: 'pending',
    });
    return res.status(201).json({ friendship: { id: doc._id, status: doc.status } });
  } catch (err) {
    if (err.code === '23505') {
      const existing = await Friendship.findByPairKey(
        friendshipPairKey(req.user.id, String(req.body?.userId || ''))
      );
      return res.json({ friendship: { id: existing._id, status: existing.status } });
    }
    return next(err);
  }
});

router.post('/friends/:id/accept', auth, async (req, res, next) => {
  try {
    if (!UUID_PATTERN.test(req.params.id)) {
      return res.status(404).json({ message: 'Friend request not found' });
    }
    const doc = await Friendship.accept(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ message: 'Friend request not found' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

router.delete('/friends/:id', auth, async (req, res, next) => {
  try {
    if (!UUID_PATTERN.test(req.params.id)) {
      return res.status(404).json({ message: 'Friendship not found' });
    }
    const doc = await Friendship.remove(req.params.id, req.user.id);
    if (!doc) return res.status(404).json({ message: 'Friendship not found' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

async function serializeRoom(room) {
  const users = room.members.map((member) => member.user).filter(Boolean);
  const presence = await getPresenceForUsers(users);
  return {
    id: room._id,
    code: room.code,
    name: room.name || '',
    host: room.host,
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
        room = await FocusRoom.create({ code: generateRoomCode(), name, host: req.user.id });
        break;
      } catch (err) {
        if (err.code !== '23505') throw err;
      }
    }
    if (!room) return res.status(500).json({ message: 'Could not create room' });
    return res.status(201).json({ room: await serializeRoom(room) });
  } catch (err) {
    return next(err);
  }
});

router.post('/rooms/:code/join', auth, async (req, res, next) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase();
    let room = await FocusRoom.findActiveByCode(code);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    room = await FocusRoom.join(room._id, req.user.id);
    return res.json({ room: await serializeRoom(room) });
  } catch (err) {
    return next(err);
  }
});

router.get('/rooms/:code', auth, async (req, res, next) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase();
    const room = await FocusRoom.findActiveByCode(code);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    if (!room.members.some((member) => member.user._id === req.user.id)) {
      return res.status(403).json({ message: 'Join this room first' });
    }
    return res.json({ room: await serializeRoom(room) });
  } catch (err) {
    return next(err);
  }
});

router.post('/rooms/:code/leave', auth, async (req, res, next) => {
  try {
    const code = String(req.params.code || '')
      .trim()
      .toUpperCase();
    const room = await FocusRoom.findActiveByCode(code);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    await FocusRoom.leave(room._id, req.user.id);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

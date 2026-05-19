const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema(
  {
    requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pairKey: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'accepted'],
      default: 'pending',
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Friendship', friendshipSchema);

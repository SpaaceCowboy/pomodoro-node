const mongoose = require('mongoose');

const focusRoomSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: '' },
    host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

focusRoomSchema.index({ code: 1, active: 1 });

module.exports = mongoose.model('FocusRoom', focusRoomSchema);

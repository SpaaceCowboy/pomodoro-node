const mongoose = require('mongoose');
const { EMAIL_PATTERN, USERNAME_PATTERN } = require('../utils/authValidation');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', maxlength: 80 },
    nickname: { type: String, default: '' },
    avatarDataUrl: { type: String, default: '' },
    publicProfileEnabled: { type: Boolean, default: false },
    username: {
      type: String,
      required: true,
      unique: true,
      match: USERNAME_PATTERN,
      maxlength: 30,
    },
    email: { type: String, required: true, unique: true, match: EMAIL_PATTERN, maxlength: 254 },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);

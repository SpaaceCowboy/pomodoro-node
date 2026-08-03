const mongoose = require('mongoose');
const { EMAIL_PATTERN, USERNAME_PATTERN } = require('../utils/authValidation');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true, maxlength: 80 },
    nickname: { type: String, default: '' },
    avatarDataUrl: { type: String, default: '' },
    publicProfileEnabled: { type: Boolean, default: false },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: USERNAME_PATTERN,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: EMAIL_PATTERN,
      maxlength: 254,
    },
    password: { type: String, required: true },
  },
  { timestamps: true }
);

const normalizedUniqueIndex = { unique: true, collation: { locale: 'en', strength: 2 } };
userSchema.index({ username: 1 }, { ...normalizedUniqueIndex, name: 'username_normalized_unique' });
userSchema.index({ email: 1 }, { ...normalizedUniqueIndex, name: 'email_normalized_unique' });

module.exports = mongoose.model('User', userSchema);

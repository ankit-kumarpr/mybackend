const mongoose = require('mongoose');

const OtpSchema = new mongoose.Schema({
  target: { type: String, required: true }, // email or phone
  code: { type: String, required: true },
  type: { type: String, enum: ['email_verify','phone_login'], required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }
});

OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

module.exports = mongoose.model('Otp', OtpSchema);

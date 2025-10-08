const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["super_admin", "admin", "sales_person", "vendor", "user", "individual"],
    default: "user",
  },
  customId: {
    type: String,
    unique: true,
    index: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  kycStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  kycDocuments: {
    identityProof: {
      type: String,
      default: null,
    },
    addressProof: {
      type: String,
      default: null,
    },
    businessProof: {
      type: String,
      default: null,
    },
  },
  kycRejectionReason: {
    type: String,
    default: null,
  },
  kycSubmittedAt: {
    type: Date,
    default: null,
  },
  kycApprovedAt: {
    type: Date,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 📌 Pre-save hook to generate customId
UserSchema.pre("save", async function (next) {
  if (this.isNew && !this.customId) {
    try {
      // Count existing users of this role
      const count = await mongoose.model("User").countDocuments({ role: this.role });

      // Generate ID like gnetecomadmin0001
      const roleCode = this.role.replace("_", ""); // remove underscores for neatness
      const sequence = String(count + 1).padStart(4, "0");

      this.customId = `gnetecom${roleCode}${sequence}`;
    } catch (err) {
      return next(err);
    }
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);

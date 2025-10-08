const mongoose = require("mongoose");

const VendorKycSchema = new mongoose.Schema(
  {
    customId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    user_role: {
      type: String,
      enum: ["vendor", "individual"],
      required: true,
    },

    // Personal Details (name, email, phone already in User model)
    personal_details: {
      aadhar_number: {
        type: String,
        required: true,
        trim: true,
        match: /^[0-9]{12}$/,
      },
      aadhar_card_image: {
        type: String, // URL or file path
        required: true,
      },
      profile_photo: {
        type: String, // URL or file path
        required: true,
      },
      personal_address: {
        street_address: {
          type: String,
          required: true,
          trim: true,
        },
        city: {
          type: String,
          required: true,
          trim: true,
        },
        state: {
          type: String,
          required: true,
          trim: true,
        },
        pincode: {
          type: String,
          required: true,
          trim: true,
          match: /^[1-9][0-9]{5}$/,
        },
        landmark: {
          type: String,
          trim: true,
        },
      },
    },

    // Business Details (optional for individual users)
    business_details: {
      shop_name: {
        type: String,
        required: function () {
          return this.user_role === "vendor";
        },
        trim: true,
        minlength: 2,
        maxlength: 100,
      },
      category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "VendorCategory",
        required: function () {
          return this.user_role === "vendor";
        },
      },
      gst_number: {
        type: String,
        trim: true,
        match: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      },
      business_address: {
        street_address: {
          type: String,
          required: function () {
            return this.user_role === "vendor";
          },
          trim: true,
        },
        city: {
          type: String,
          required: function () {
            return this.user_role === "vendor";
          },
          trim: true,
        },
        state: {
          type: String,
          required: function () {
            return this.user_role === "vendor";
          },
          trim: true,
        },
        country: {
          type: String,
          required: function () {
            return this.user_role === "vendor";
          },
          trim: true,
          default: "India",
        },
        pincode: {
          type: String,
          required: function () {
            return this.user_role === "vendor";
          },
          trim: true,
          match: /^[1-9][0-9]{5}$/,
        },
        landmark: {
          type: String,
          trim: true,
        },
      },
      shop_photo: {
        type: String, // URL or file path
        required: function () {
          return this.user_role === "vendor";
        },
      },
    },

    // Video KYC
    video_kyc: {
      video_url: {
        type: String, // URL or file path
        required: true,
      },
      duration: {
        type: Number, // Duration in seconds
        required: true,
        min: 15,
        max: 20,
      },
    },

    // KYC Status and Approval
    kyc_status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    // Approval Details
    approval_details: {
      approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      approved_at: {
        type: Date,
      },
      rejection_reason: {
        type: String,
        trim: true,
      },
      admin_notes: {
        type: String,
        trim: true,
      },
    },

    // Submission tracking
    submitted_at: {
      type: Date,
      default: Date.now,
    },

    // Completion status for each section
    completion_status: {
      personal_details: {
        type: Boolean,
        default: false,
      },
      business_details: {
        type: Boolean,
        default: false,
      },
      video_kyc: {
        type: Boolean,
        default: false,
      },
    },

    // Overall completion
    is_completed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
VendorKycSchema.index({ kyc_status: 1 });
VendorKycSchema.index({ submitted_at: -1 });

// Pre-save middleware to generate custom ID and check completion
VendorKycSchema.pre("save", async function (next) {
  try {
    // Generate custom ID if not exists (fallback for cases where it wasn't set in controller)
    if (this.isNew && !this.customId) {
      const vendor = await mongoose.model("User").findById(this.vendor_id);
      if (vendor) {
        const vendorName = vendor.name
          .replace(/[^a-zA-Z0-9]/g, "")
          .toLowerCase()
          .substring(0, 6);
        const shopName = this.business_details?.shop_name
          ? this.business_details.shop_name
              .replace(/[^a-zA-Z0-9]/g, "")
              .toLowerCase()
              .substring(0, 6)
          : "shop";
        const randomNumber = Math.floor(1000 + Math.random() * 9000);

        let customId = `kyc${vendorName}${shopName}${randomNumber}`;

        // Ensure uniqueness
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
          const existingKyc = await mongoose
            .model("VendorKyc")
            .findOne({ customId });
          if (!existingKyc) {
            isUnique = true;
          } else {
            customId = `kyc${vendorName}${shopName}${Math.floor(
              1000 + Math.random() * 9000
            )}`;
            attempts++;
          }
        }

        if (!isUnique) {
          return next(new Error("Unable to generate unique custom ID"));
        }

        this.customId = customId;
      }
    }

    // Check completion status based on user role
    const { personal_details, business_details, video_kyc } =
      this.completion_status;

    if (this.user_role === "individual") {
      // For individuals, only personal_details and video_kyc are required
      if (personal_details && video_kyc) {
        this.is_completed = true;
      } else {
        this.is_completed = false;
      }
    } else {
      // For vendors, all three sections are required
      if (personal_details && business_details && video_kyc) {
        this.is_completed = true;
      } else {
        this.is_completed = false;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("VendorKyc", VendorKycSchema);

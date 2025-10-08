const mongoose = require("mongoose");

const VendorCategorySchema = new mongoose.Schema(
  {
    customId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    category_name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    category_description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    category_image: {
      type: String,
      trim: true,
      default: null,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("VendorCategory", VendorCategorySchema);

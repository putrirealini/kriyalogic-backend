const mongoose = require('mongoose');

const masterProductSchema = new mongoose.Schema(
  {
    parentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    categoryName: {
      type: String,
      required: [true, 'Please add a category name'],
      trim: true
    },
    productName: {
      type: String,
      required: [true, 'Please add a master product name'],
      trim: true
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    description: {
      type: String,
      default: '',
      trim: true
    },

    woodTypes: [
      {
        type: String,
        trim: true
      }
    ],

    logo: {
      type: String,
      default: '',
      trim: true
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MasterProduct', masterProductSchema);
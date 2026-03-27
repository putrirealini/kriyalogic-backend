const mongoose = require('mongoose');

const productItemSchema = new mongoose.Schema(
  {
    masterProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterProduct',
      required: [true, 'Master product is required']
    },

    itemName: {
      type: String,
      default: '',
      trim: true
    },

    childCode: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    barcode: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    productPhoto: {
      type: String,
      default: ''
    },

    woodType: {
      type: String,
      default: '',
      trim: true
    },

    dimension: {
      type: String,
      default: '',
      trim: true
    },

    artisanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artisan',
      required: [true, 'Artisan is required']
    },

    costPrice: {
      type: Number,
      required: [true, 'Please add cost price'],
      min: 0
    },

    sellingPrice: {
      type: Number,
      required: [true, 'Please add selling price'],
      min: 0
    },

    status: {
      type: String,
      enum: ['available', 'reserved', 'sold'],
      default: 'available'
    },

    reservedAt: {
      type: Date,
      default: null
    },

    soldAt: {
      type: Date,
      default: null
    },

    notes: {
      type: String,
      default: '',
      trim: true
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ProductItem', productItemSchema);
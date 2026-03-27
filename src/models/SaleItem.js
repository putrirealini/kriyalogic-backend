const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    saleTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SaleTransaction',
      required: true
    },

    productItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductItem',
      required: true
    },

    masterProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterProduct',
      required: true
    },

    artisanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Artisan',
      required: true
    },

    parentCodeSnapshot: {
      type: String,
      required: true
    },

    childCodeSnapshot: {
      type: String,
      required: true
    },

    categoryNameSnapshot: {
      type: String,
      default: ''
    },

    productNameSnapshot: {
      type: String,
      required: true
    },

    artisanNameSnapshot: {
      type: String,
      default: ''
    },

    costPriceSnapshot: {
      type: Number,
      required: true,
      min: 0
    },

    sellingPriceSnapshot: {
      type: Number,
      required: true,
      min: 0
    },

    artisanCommissionRateSnapshot: {
      type: Number,
      default: 0
    },

    artisanCommissionAmount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// saleItemSchema.index({ saleTransactionId: 1 });
// saleItemSchema.index({ productItemId: 1 }, { unique: true });
// saleItemSchema.index({ artisanId: 1 });
// saleItemSchema.index({ masterProductId: 1 });

module.exports = mongoose.model('SaleItem', saleItemSchema);
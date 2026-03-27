const mongoose = require('mongoose');

const saleTransactionSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guide',
      default: null
    },

    guideNameSnapshot: {
      type: String,
      default: ''
    },

    guideCommissionRateSnapshot: {
      type: Number,
      default: 0
    },

    guideCommissionAmount: {
      type: Number,
      default: 0
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    grandTotal: {
      type: Number,
      required: true,
      min: 0
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'qris', 'card', 'transfer'],
      default: 'cash'
    },

    paidAmount: {
      type: Number,
      required: true,
      min: 0
    },

    changeAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    soldAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// saleTransactionSchema.index({ receiptNumber: 1 }, { unique: true });
// saleTransactionSchema.index({ cashierId: 1 });
// saleTransactionSchema.index({ guideId: 1 });
// saleTransactionSchema.index({ soldAt: -1 });

module.exports = mongoose.model('SaleTransaction', saleTransactionSchema);
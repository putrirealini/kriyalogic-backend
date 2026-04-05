const mongoose = require('mongoose');

const posOrderItemSchema = new mongoose.Schema(
  {
    productItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductItem',
      required: true
    },
    masterProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MasterProduct',
      default: null
    },
    itemName: {
      type: String,
      required: true,
      trim: true
    },
    childCode: {
      type: String,
      default: '',
      trim: true
    },
    image: {
      type: String,
      default: '',
      trim: true
    },
    qty: {
      type: Number,
      default: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const posOrderSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    customerName: {
      type: String,
      default: '',
      trim: true
    },
    customerPhone: {
      type: String,
      default: '',
      trim: true
    },

    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    cashierName: {
      type: String,
      default: '',
      trim: true
    },

    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guide',
      default: null
    },
    guideName: {
      type: String,
      default: '',
      trim: true
    },
    guideCommissionRate: {
      type: Number,
      default: 0,
      min: 0
    },
    guideCommissionAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    items: {
      type: [posOrderItemSchema],
      default: []
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0
    },
    taxPercent: {
      type: Number,
      default: 0,
      min: 0
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    deliveryFee: {
      type: Number,
      default: 0,
      min: 0
    },
    discount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'qris'],
      required: true
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0
    },
    changeAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ['paid', 'cancelled'],
      default: 'paid'
    },

    paidAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

posOrderSchema.index({ paidAt: -1, createdAt: -1 });
posOrderSchema.index({ receiptNumber: 1 });
posOrderSchema.index({ customerName: 1 });
posOrderSchema.index({ cashierName: 1 });
posOrderSchema.index({ paymentMethod: 1 });

module.exports = mongoose.model('PosOrder', posOrderSchema);
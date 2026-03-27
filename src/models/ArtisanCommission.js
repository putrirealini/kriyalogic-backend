const mongoose = require('mongoose');

const artisanCommissionSchema = new mongoose.Schema({
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Artisan',
    required: [true, 'Artisan is required']
  },
  productItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProductItem',
    required: [true, 'Product item is required']
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PosOrder',
    required: [true, 'Order is required']
  },
  itemName: {
    type: String,
    required: [true, 'Please add a item name'],
    trim: true
  },
  childCode: {
    type: String,
    required: true,
    trim: true
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Please add selling price'],
    min: 0
  },
  commissionRate: {
    type: Number,
    required: [true, 'Please add a commission rate']
  },
  commissionAmount: {
    type: Number,
    required: [true, 'Please add commission amount'],
    min: 0
  },
  status: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid'
  },
  paidAt: {
    type: Date,
    default: null,
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ArtisanCommission', artisanCommissionSchema);

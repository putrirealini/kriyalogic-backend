const mongoose = require('mongoose');

const deliveryRecordSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  recipientName: {
    type: String,
    required: true
  },
  originalCourierCost: {
    type: Number,
    required: true
  },
  storeProfit15Percent: {
    type: Number,
    required: true
  },
  totalShippingPrice: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DeliveryRecord', deliveryRecordSchema);
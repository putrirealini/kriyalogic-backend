const mongoose = require('mongoose');

const analyticsRecordSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  artisanName: {
    type: String,
    required: true
  },
  tourGuide: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  totalSales: {
    type: Number,
    required: true
  },
  artisanCommission: {
    type: Number,
    required: true
  },
  guideCommission: {
    type: Number,
    required: true
  },
  netProfit: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AnalyticsRecord', analyticsRecordSchema);
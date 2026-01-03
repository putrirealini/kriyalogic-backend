const mongoose = require('mongoose');

const guideSchema = new mongoose.Schema({
  guideName: {
    type: String,
    required: [true, 'Please add a guide name'],
    trim: true
  },
  agency: {
    type: String,
    required: [true, 'Please add an agency'],
    trim: true
  },
  commissionRate: {
    type: Number,
    required: [true, 'Please add a commission rate']
  },
  contact: {
    type: String,
    required: [true, 'Please add a contact number'],
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Guide', guideSchema);

const mongoose = require('mongoose');

const artisanSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Please add a full name'],
    trim: true
  },
  phoneNumber: {
    type: String,
    required: [true, 'Please add a phone number'],
    unique: true,
    trim: true
  },
  commissionRate: {
    type: Number,
    required: [true, 'Please add a commission rate']
  },
  bankAccount: {
    type: String,
    required: [true, 'Please add a bank account'],
    trim: true
  },
  address: {
    type: String,
    required: [true, 'Please add an address']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Artisan', artisanSchema);

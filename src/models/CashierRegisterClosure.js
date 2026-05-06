const mongoose = require('mongoose');

const cashierRegisterClosureSchema = new mongoose.Schema(
  {
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    cashierName: {
      type: String,
      default: '',
      trim: true
    },

    reportDate: {
      type: Date,
      required: true,
      index: true
    },

    actualCash: {
      type: Number,
      required: true,
      min: 0
    },

    cashierNotes: {
      type: String,
      default: '',
      trim: true
    },

    closedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

cashierRegisterClosureSchema.index(
  { cashierId: 1, reportDate: 1 },
  { unique: true }
);

module.exports = mongoose.model('CashierRegisterClosure', cashierRegisterClosureSchema);
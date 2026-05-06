const mongoose = require('mongoose');

const courierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Courier name is required'],
      trim: true,
      unique: true
    },

    code: {
      type: String,
      default: '',
      trim: true,
      uppercase: true
    },

    type: {
      type: String,
      enum: ['regular', 'cargo', 'same_day', 'instant', 'other'],
      default: 'regular'
    },

    phoneNumber: {
      type: String,
      default: '',
      trim: true
    },

    email: {
      type: String,
      default: '',
      trim: true
    },

    address: {
      type: String,
      default: '',
      trim: true
    },

    notes: {
      type: String,
      default: '',
      trim: true
    },

    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active'
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

courierSchema.index({ name: 1 }, { unique: true });
courierSchema.index({ status: 1 });
courierSchema.index({ code: 1 });

module.exports = mongoose.model('Courier', courierSchema);
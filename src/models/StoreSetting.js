const mongoose = require('mongoose');

const storeSettingSchema = new mongoose.Schema(
  {
    shopNameOnReceipt: {
      type: String,
      default: '',
      trim: true
    },
    slogan: {
      type: String,
      default: '',
      trim: true
    },
    storeAddress: {
      type: String,
      default: '',
      trim: true
    },
    footerGreeting: {
      type: String,
      default: '',
      trim: true
    },
    returnPolicyText: {
      type: String,
      default: '',
      trim: true
    },
    whatsappNumber: {
      type: String,
      default: '',
      trim: true
    },
    instagramUsername: {
      type: String,
      default: '',
      trim: true
    },
    isTaxed: {
      type: Boolean,
      default: false
    },
    logo: {
      type: String,
      default: ''
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

module.exports = mongoose.model('StoreSetting', storeSettingSchema);
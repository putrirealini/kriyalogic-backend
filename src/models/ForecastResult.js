const mongoose = require('mongoose');

const forecastResultSchema = new mongoose.Schema(
  {
    product_code: {
      type: String,
      required: true,
      index: true
    },
    forecast_date: {
      type: Date,
      required: true
    },
    predicted_demand: {
      type: Number,
      required: true
    },
    lower_bound_estimate: {
      type: Number,
      required: true
    },
    upper_bound_estimate: {
      type: Number,
      required: true
    },
    last_updated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compound index for efficient queries
forecastResultSchema.index({ product_code: 1, forecast_date: 1 });

module.exports = mongoose.model('ForecastResult', forecastResultSchema);
const mongoose = require('mongoose');
const ForecastResult = require('../models/ForecastResult');
const MasterProduct = require('../models/MasterProduct');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * @desc    Get forecast data by parent code or product name
 * @route   GET /api/forecast/:identifier
 * @access  Public
 * @param   identifier - can be product code (e.g., 'PB001') or product name (e.g., 'Patung Buddha')
 */
const getForecastByParentCode = asyncHandler(async (req, res) => {
  const { parent_code } = req.params;

  if (!parent_code) {
    return res.status(400).json({
      success: false,
      message: 'Product code or name is required'
    });
  }

  try {
    // First, try to find using product_code directly
    let forecasts = await ForecastResult.find({ product_code: parent_code })
      .sort({ forecast_date: 1 });

    // If no results, try to find the master product by name and then get its code
    if (!forecasts || forecasts.length === 0) {
      console.log(`No forecast found for product_code: ${parent_code}, searching by product name...`);
      
      const masterProduct = await MasterProduct.findOne({ productName: parent_code });
      
      if (masterProduct) {
        console.log(`Found master product: ${masterProduct.productName} with code: ${masterProduct.parentCode}`);
        forecasts = await ForecastResult.find({ product_code: masterProduct.parentCode })
          .sort({ forecast_date: 1 });
      }
    }

    if (!forecasts || forecasts.length === 0) {
      console.warn(`⚠ No forecast data found for identifier: ${parent_code}`);
      return res.status(404).json({
        success: false,
        message: `No forecast data found for product: ${parent_code}. Please ensure forecast data has been seeded.`,
        identifier: parent_code
      });
    }

    console.log(`✓ Found ${forecasts.length} forecast records for: ${parent_code}`);
    return res.status(200).json({
      success: true,
      data: forecasts,
      count: forecasts.length
    });
  } catch (error) {
    console.error(`✗ Error fetching forecast data:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching forecast data',
      error: error.message
    });
  }
});

/**
 * @desc    Get all available products for forecast
 * @route   GET /api/forecast/products/list
 * @access  Public
 */
const getAvailableProducts = asyncHandler(async (req, res) => {
  try {
    const products = await MasterProduct.find({ status: 'active' })
      .select('parentCode productName')
      .sort({ productName: 1 });

    if (!products || products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No active products found'
      });
    }

    return res.status(200).json({
      success: true,
      data: products,
      count: products.length
    });
  } catch (error) {
    console.error(`✗ Error fetching products:`, error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching products',
      error: error.message
    });
  }
});

module.exports = {
  getForecastByParentCode,
  getAvailableProducts
};
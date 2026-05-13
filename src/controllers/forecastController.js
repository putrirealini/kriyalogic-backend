const mongoose = require('mongoose');
const { exec } = require('child_process');
const path = require('path');
const ForecastResult = require('../models/ForecastResult');
const MasterProduct = require('../models/MasterProduct');
const ProductItem = require('../models/ProductItem');
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

    let actualCode = parent_code;
    
    // If no results, try to find the master product by name and then get its code
    if (!forecasts || forecasts.length === 0) {
      console.log(`No forecast found for product_code: ${parent_code}, searching by product name...`);
      
      const masterProduct = await MasterProduct.findOne({ productName: parent_code });
      
      if (masterProduct) {
        console.log(`Found master product: ${masterProduct.productName} with code: ${masterProduct.parentCode}`);
        actualCode = masterProduct.parentCode;
        forecasts = await ForecastResult.find({ product_code: actualCode })
          .sort({ forecast_date: 1 });
      }
    }

    // Dynamic generation if still not found
    if (!forecasts || forecasts.length === 0) {
      console.log(`No forecast data found for identifier: ${actualCode}. Generating dynamically via ML Engine...`);
      
      try {
        await new Promise((resolve, reject) => {
          const scriptPath = path.resolve(__dirname, '../../../../ai_engine/ml_forecasting.py');
          const pythonExec = path.resolve(__dirname, '../../../../.venv/bin/python');
          const engineDir = path.resolve(__dirname, '../../../../ai_engine');

          console.log(`Running: ${pythonExec} ${scriptPath} ${actualCode}`);
          
          exec(`"${pythonExec}" "${scriptPath}" "${actualCode}"`, {
            cwd: engineDir
          }, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error executing ML script: ${error.message}`);
              return reject(error);
            }
            if (stderr) {
              console.warn(`ML Script Warning/Error output: ${stderr}`);
            }
            console.log(`ML Script Output:\n${stdout}`);
            resolve();
          });
        });

        // Try to fetch again after generation
        forecasts = await ForecastResult.find({ product_code: actualCode })
          .sort({ forecast_date: 1 });

      } catch (genError) {
        console.error('Failed to generate forecast dynamically:', genError);
      }
    }

    if (!forecasts || forecasts.length === 0) {
      console.warn(`⚠ Still no forecast data found after dynamic generation for identifier: ${actualCode}`);
      return res.status(404).json({
        success: false,
        message: `No forecast data found for product: ${parent_code}. Dynamic generation also failed or no historical sales data available.`,
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

const getForecastData = asyncHandler(async (req, res) => {
  try {
    const { month, year } = req.query;

    const hasMonthFilter = month !== undefined && month !== '';
    const hasYearFilter = year !== undefined && year !== '';

    if (hasMonthFilter !== hasYearFilter) {
      return res.status(400).json({
        success: false,
        message: 'month and year query parameters must be provided together'
      });
    }

    let startDate;
    let endDate;
    let period;

    if (hasMonthFilter && hasYearFilter) {
      const monthNumber = Number.parseInt(month, 10);
      const yearNumber = Number.parseInt(year, 10);

      if (
        Number.isNaN(monthNumber) ||
        Number.isNaN(yearNumber) ||
        monthNumber < 1 ||
        monthNumber > 12 ||
        yearNumber < 1900
      ) {
        return res.status(400).json({
          success: false,
          message: 'month must be between 1-12 and year must be a valid year'
        });
      }

      startDate = new Date(yearNumber, monthNumber - 1, 1);
      endDate = new Date(yearNumber, monthNumber, 1);

      period = {
        month: monthNumber,
        year: yearNumber,
        start_date: startDate,
        end_date: endDate
      };
    } else {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 30);

      period = {
        start_date: startDate,
        end_date: endDate
      };
    }

    const forecasts = await ForecastResult.aggregate([
      {
        $match: {
          forecast_date: {
            $gte: startDate,
            $lt: endDate
          }
        }
      },
      {
        $group: {
          _id: '$product_code',
          predicted_stock: { $sum: '$predicted_quantity' }
        }
      },
      {
        $sort: {
          _id: 1
        }
      }
    ]);

    /**
     * Jangan return 404 kalau data kosong.
     * Endpoint-nya ada, datanya saja belum ada.
     */
    if (!forecasts || forecasts.length === 0) {
      return res.status(200).json({
        success: true,
        period,
        data: [],
        count: 0,
        message: hasMonthFilter && hasYearFilter
          ? 'No forecast data found for the selected month and year'
          : 'No forecast data found for the next 30 days'
      });
    }

    const productCodes = forecasts.map((forecast) => forecast._id);

    const products = await MasterProduct.find({
      parentCode: { $in: productCodes }
    }).select('parentCode productName');

    const productMap = new Map(
      products.map((product) => [product.parentCode, product])
    );

    const productIds = products.map((product) => product._id);

    const stockCounts = await ProductItem.aggregate([
      {
        $match: {
          masterProductId: { $in: productIds }
        }
      },
      {
        $group: {
          _id: '$masterProductId',
          actual_stock: { $sum: 1 }
        }
      }
    ]);

    const stockMap = new Map(
      stockCounts.map((stock) => [
        stock._id.toString(),
        stock.actual_stock
      ])
    );

    const data = forecasts.map((forecast) => {
      const product = productMap.get(forecast._id);

      const actualStock = product
        ? stockMap.get(product._id.toString()) || 0
        : 0;

      const predictedStock = forecast.predicted_stock || 0;

      return {
        product_name: product?.productName || '',
        product_code: forecast._id,
        actual_stock: actualStock,
        predicted_stock: predictedStock,
        remaining_stock: predictedStock - actualStock
      };
    });

    return res.status(200).json({
      success: true,
      period,
      data,
      count: data.length
    });
  } catch (error) {
    console.error('✗ Error fetching forecast data:', error);

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
  getAvailableProducts,
  getForecastData
};

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
          const engineDir = path.resolve(__dirname, '../../../kriyalogic-forecasting');
          const scriptPath = path.join(engineDir, 'ml_forecasting.py');
          const pythonExec = path.join(engineDir, 'venv/bin/python');

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

    let period = {
      all: true
    };

    let startDate = null;
    let endDate = null;

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

      startDate = new Date(
        Date.UTC(yearNumber, monthNumber - 1, 1, 0, 0, 0, 0)
      );

      endDate = new Date(
        Date.UTC(yearNumber, monthNumber, 1, 0, 0, 0, 0)
      );

      period = {
        month: monthNumber,
        year: yearNumber,
        start_date: startDate,
        end_date: endDate
      };

      console.log('monthNumber:', monthNumber);
      console.log('yearNumber:', yearNumber);
      console.log('startDate:', startDate);
      console.log('endDate:', endDate);
    }

    console.log('Fetching forecast data for period:', period);

    const basePipeline = [
      {
        $addFields: {
          forecast_date_parsed: {
            $convert: {
              input: '$forecast_date',
              to: 'date',
              onError: null,
              onNull: null
            }
          }
        }
      },
      {
        $match: {
          forecast_date_parsed: {
            $ne: null
          }
        }
      }
    ];

    const dateMatchStage =
      hasMonthFilter && hasYearFilter
        ? [
            {
              $match: {
                forecast_date_parsed: {
                  $gte: startDate,
                  $lt: endDate
                }
              }
            }
          ]
        : [];

    const availableMonths = await ForecastResult.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: {
            year: {
              $year: '$forecast_date_parsed'
            },
            month: {
              $month: '$forecast_date_parsed'
            }
          },
          total_records: {
            $sum: 1
          },
          first_date: {
            $min: '$forecast_date_parsed'
          },
          last_date: {
            $max: '$forecast_date_parsed'
          }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1
        }
      }
    ]);

    console.log('Available forecast months:', availableMonths);

    const forecasts = await ForecastResult.aggregate([
      ...basePipeline,
      ...dateMatchStage,
      {
        $group: {
          _id: '$product_code',

          predicted_stock: {
            $sum: {
              $ifNull: ['$predicted_quantity', 0]
            }
          },

          lower_bound_estimate: {
            $sum: {
              $ifNull: ['$lower_bound_estimate', 0]
            }
          },

          upper_bound_estimate: {
            $sum: {
              $ifNull: ['$upper_bound_estimate', 0]
            }
          },

          total_forecast_days: {
            $sum: 1
          },

          first_forecast_date: {
            $min: '$forecast_date_parsed'
          },

          last_forecast_date: {
            $max: '$forecast_date_parsed'
          }
        }
      },
      {
        $sort: {
          _id: 1
        }
      }
    ]);

    console.log(
      `Found ${forecasts.length} forecast records for the specified period.`
    );

    if (!forecasts || forecasts.length === 0) {
      return res.status(200).json({
        success: true,
        period,
        data: [],
        count: 0,
        available_months: availableMonths,
        message:
          hasMonthFilter && hasYearFilter
            ? 'No forecast data found for the selected month and year'
            : 'No forecast data found'
      });
    }

    const productIdentifiers = forecasts
      .map((forecast) => forecast._id)
      .filter(Boolean);

    const normalizedProductNames = productIdentifiers.map((identifier) =>
      identifier.replace(/_/g, ' ')
    );

    const normalizedSlugs = productIdentifiers.map((identifier) =>
      identifier.toLowerCase().replace(/_/g, '-')
    );

    const products = await MasterProduct.find({
      $or: [
        {
          parentCode: {
            $in: productIdentifiers
          }
        },
        {
          productName: {
            $in: productIdentifiers
          }
        },
        {
          productName: {
            $in: normalizedProductNames
          }
        },
        {
          slug: {
            $in: normalizedSlugs
          }
        }
      ]
    }).select('parentCode productName slug');

    const productMap = new Map();

    products.forEach((product) => {
      if (product.parentCode) {
        productMap.set(product.parentCode, product);
      }

      if (product.productName) {
        productMap.set(product.productName, product);
        productMap.set(product.productName.replace(/\s+/g, '_'), product);
      }

      if (product.slug) {
        productMap.set(product.slug, product);
        productMap.set(product.slug.replace(/-/g, '_'), product);
      }
    });

    const productIds = products.map((product) => product._id);

    let stockCounts = [];

    if (productIds.length > 0) {
      stockCounts = await ProductItem.aggregate([
        {
          $match: {
            masterProductId: {
              $in: productIds
            },
            status: 'available'
          }
        },
        {
          $group: {
            _id: '$masterProductId',
            actual_stock: {
              $sum: 1
            }
          }
        }
      ]);
    }

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

      const predictedStock = Math.round(forecast.predicted_stock || 0);
      const remainingStock = Math.round(predictedStock - actualStock);

      return {
        product_name: product?.productName || forecast._id,
        product_code: product?.parentCode || forecast._id,

        actual_stock: actualStock,
        predicted_stock: predictedStock,
        remaining_stock: remainingStock,

        lower_bound_estimate: forecast.lower_bound_estimate || 0,
        upper_bound_estimate: forecast.upper_bound_estimate || 0,

        total_forecast_days: forecast.total_forecast_days || 0,
        first_forecast_date: forecast.first_forecast_date || null,
        last_forecast_date: forecast.last_forecast_date || null
      };
    });

    return res.status(200).json({
      success: true,
      period,
      data,
      count: data.length,
      available_months: availableMonths
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

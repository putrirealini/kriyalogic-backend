const mongoose = require('mongoose');
const { exec } = require('child_process');
const path = require('path');
const ForecastResult = require('../models/ForecastResult');
const MasterProduct = require('../models/MasterProduct');
const ProductItem = require('../models/ProductItem');
const asyncHandler = require('../middleware/asyncHandler');

const AVAILABLE_MONTHS_CACHE_TTL_MS = 5 * 60 * 1000;
const MASTER_PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
const FORECAST_SUMMARY_CACHE_TTL_MS = 60 * 1000;

const forecastCache = {
  availableMonths: {
    expiresAt: 0,
    data: []
  },
  productLookup: {
    expiresAt: 0,
    map: new Map(),
    products: []
  },
  summaries: new Map()
};

const getAvailableMonths = async () => {
  const now = Date.now();

  if (forecastCache.availableMonths.expiresAt > now) {
    return forecastCache.availableMonths.data;
  }

  const availableMonths = await ForecastResult.aggregate([
    {
      $match: {
        forecast_date: {
          $type: 'date'
        }
      }
    },
    {
      $group: {
        _id: {
          year: {
            $year: '$forecast_date'
          },
          month: {
            $month: '$forecast_date'
          }
        },
        total_records: {
          $sum: 1
        },
        first_date: {
          $min: '$forecast_date'
        },
        last_date: {
          $max: '$forecast_date'
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

  forecastCache.availableMonths = {
    expiresAt: now + AVAILABLE_MONTHS_CACHE_TTL_MS,
    data: availableMonths
  };

  return availableMonths;
};

const getMasterProductLookup = async () => {
  const now = Date.now();

  if (forecastCache.productLookup.expiresAt > now) {
    return forecastCache.productLookup;
  }

  const products = await MasterProduct.find({})
    .select('parentCode productName slug')
    .lean();

  const map = new Map();

  products.forEach((product) => {
    if (product.parentCode) {
      map.set(product.parentCode, product);
    }

    if (product.productName) {
      map.set(product.productName, product);
      map.set(product.productName.replace(/\s+/g, '_'), product);
    }

    if (product.slug) {
      map.set(product.slug, product);
      map.set(product.slug.replace(/-/g, '_'), product);
    }
  });

  forecastCache.productLookup = {
    expiresAt: now + MASTER_PRODUCT_CACHE_TTL_MS,
    map,
    products
  };

  return forecastCache.productLookup;
};

const getForecastSummary = async (cacheKey, forecastDateMatchStage) => {
  const now = Date.now();
  const cached = forecastCache.summaries.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const forecasts = await ForecastResult.aggregate([
    forecastDateMatchStage,
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
          $min: '$forecast_date'
        },

        last_forecast_date: {
          $max: '$forecast_date'
        }
      }
    },
    {
      $sort: {
        _id: 1
      }
    }
  ]);

  forecastCache.summaries.set(cacheKey, {
    expiresAt: now + FORECAST_SUMMARY_CACHE_TTL_MS,
    data: forecasts
  });

  return forecasts;
};

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

    const validForecastDateStage = {
      $match: {
        forecast_date: {
          $type: 'date'
        }
      }
    };

    const forecastDateMatchStage =
      hasMonthFilter && hasYearFilter
        ? {
            $match: {
              forecast_date: {
                $gte: startDate,
                $lt: endDate
              }
            }
          }
        : validForecastDateStage;

    const forecastSummaryCacheKey =
      hasMonthFilter && hasYearFilter
        ? `${startDate.toISOString()}:${endDate.toISOString()}`
        : 'all';

    const [availableMonths, forecasts] = await Promise.all([
      getAvailableMonths(),
      getForecastSummary(forecastSummaryCacheKey, forecastDateMatchStage)
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

    const { map: productMap } = await getMasterProductLookup();
    const productIds = [
      ...new Set(
        forecasts
          .map((forecast) => productMap.get(forecast._id)?._id?.toString())
          .filter(Boolean)
      )
    ].map((id) => new mongoose.Types.ObjectId(id));

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

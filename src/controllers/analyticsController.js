const AnalyticsRecord = require('../models/AnalyticsRecord');
const DeliveryRecord = require('../models/DeliveryRecord');
const { exec } = require('child_process');
const path = require('path');

// Get analytics summary using aggregation pipelines
const getAnalyticsSummary = async (req, res) => {
  try {
    console.log('📊 Fetching analytics summary...');

    // Check if AnalyticsRecord collection exists and has data
    let recordCount = await AnalyticsRecord.countDocuments();
    console.log(`✓ Found ${recordCount} AnalyticsRecord documents`);

    if (recordCount === 0) {
      console.warn('⚠ No AnalyticsRecord data found. Attempting to seed data automatically...');
      
      try {
        await new Promise((resolve, reject) => {
          const backendDir = path.resolve(__dirname, '../../');
          console.log(`Running seed:analytics in ${backendDir}`);
          
          exec('npm run seed:analytics', {
            cwd: backendDir
          }, (error, stdout, stderr) => {
            if (error) {
              console.error(`Error executing seed script: ${error.message}`);
              return reject(error);
            }
            if (stderr && !stderr.includes('npm WARN')) {
              console.warn(`Seed Script Warning/Error output: ${stderr}`);
            }
            console.log(`Seed Script Output:\n${stdout}`);
            resolve();
          });
        });

        // Re-check count after seeding
        recordCount = await AnalyticsRecord.countDocuments();
        console.log(`✓ Post-seed check: Found ${recordCount} AnalyticsRecord documents`);
      } catch (seedError) {
        console.error('Failed to automatically seed analytics data:', seedError);
      }
    }

    const { from, to } = req.query;

    // Aggregate totals from AnalyticsRecord
    const analyticsTotals = await AnalyticsRecord.aggregate([
      {
        $match: {
          $and: [
            { date: { $gte: new Date(from) } },
            { date: { $lte: new Date(to) } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$quantity' },
          totalRevenue: { $sum: '$totalSales' },
          totalCommissionExpenses: {
            $sum: { $add: ['$artisanCommission', '$guideCommission'] }
          },
          netProfit: { $sum: '$netProfit' }
        }
      }
    ]);

    // Aggregate delivery profit from DeliveryRecord
    const deliveryTotals = await DeliveryRecord.aggregate([
      {
        $group: {
          _id: null,
          deliveryProfit: { $sum: '$storeProfit15Percent' }
        }
      }
    ]);

    // Top selling products by quantity
    const topSellingProducts = await AnalyticsRecord.aggregate([
      {
        $match: {
          $and: [
            { date: { $gte: new Date(from) } },
            { date: { $lte: new Date(to) } }
          ]
        }
      },
      {
        $group: {
          _id: '$productName',
          totalQuantity: { $sum: '$quantity' }
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          productName: '$_id',
          totalQuantity: 1,
          _id: 0
        }
      }
    ]);

    // Top performing tour guides by total sales
    const topPerformingTourGuides = await AnalyticsRecord.aggregate([
      {
        $match: {
          $and: [
            { date: { $gte: new Date(from) } },
            { date: { $lte: new Date(to) } }
          ]
        }
      },
      {
        $group: {
          _id: '$tourGuide',
          totalSales: { $sum: '$totalSales' }
        }
      },
      {
        $sort: { totalSales: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          tourGuide: '$_id',
          totalSales: 1,
          _id: 0
        }
      }
    ]);

    // Top performing artisans by quantity sold
    const topPerformingArtisans = await AnalyticsRecord.aggregate([
      {
        $match: {
          $and: [
            { date: { $gte: new Date(from) } },
            { date: { $lte: new Date(to) } }
          ]
        }
      },
      {
        $group: {
          _id: '$artisanName',
          totalQuantity: { $sum: '$quantity' }
        }
      },
      {
        $sort: { totalQuantity: -1 }
      },
      {
        $limit: 5
      },
      {
        $project: {
          artisanName: '$_id',
          totalQuantity: 1,
          _id: 0
        }
      }
    ]);

    // Prepare response
    const summary = {
      totalQuantity: analyticsTotals[0]?.totalQuantity || 0,
      totalRevenue: analyticsTotals[0]?.totalRevenue || 0,
      totalCommissionExpenses: analyticsTotals[0]?.totalCommissionExpenses || 0,
      netProfit: analyticsTotals[0]?.netProfit || 0,
      deliveryProfit: deliveryTotals[0]?.deliveryProfit || 0,
      topSellingProducts,
      topPerformingTourGuides,
      topPerformingArtisans
    };

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics summary',
      error: error.message
    });
  }
};

module.exports = {
  getAnalyticsSummary
};
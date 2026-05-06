const AnalyticsRecord = require('../models/AnalyticsRecord');
const DeliveryRecord = require('../models/DeliveryRecord');

// Get analytics summary using aggregation pipelines
const getAnalyticsSummary = async (req, res) => {
  try {
    console.log('📊 Fetching analytics summary...');

    // Check if AnalyticsRecord collection exists and has data
    const recordCount = await AnalyticsRecord.countDocuments();
    console.log(`✓ Found ${recordCount} AnalyticsRecord documents`);

    if (recordCount === 0) {
      console.warn('⚠ No AnalyticsRecord data found. Please seed data: npm run seed:analytics');
    }

    // Aggregate totals from AnalyticsRecord
    const analyticsTotals = await AnalyticsRecord.aggregate([
      {
        $group: {
          _id: null,
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
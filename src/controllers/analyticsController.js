const PosOrder = require('../models/PosOrder');

const parseDateRange = ({ from, to }) => {
  const match = {
    status: 'paid'
  };

  if (!from && !to) {
    return { match };
  }

  if (!from || !to) {
    return {
      error: 'from and to query parameters must be provided together'
    };
  }

  const startDate = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(from) ? `${from}T00:00:00.000Z` : from
  );
  const endDate = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59.999Z` : to
  );

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return {
      error: 'from and to must be valid dates'
    };
  }

  match.paidAt = {
    $gte: startDate,
    $lte: endDate
  };

  return { match };
};

// Get analytics summary from live POS transactions.
const getAnalyticsSummary = async (req, res) => {
  try {
    console.log('Fetching realtime analytics summary from PosOrder...');

    const { match, error } = parseDateRange(req.query);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error
      });
    }

    const [
      totalsResult,
      topSellingProducts,
      topPerformingTourGuides,
      topPerformingArtisans
    ] = await Promise.all([
      PosOrder.aggregate([
        { $match: match },
        {
          $addFields: {
            itemCostTotal: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: {
                    $multiply: [
                      { $ifNull: ['$$item.costPrice', 0] },
                      { $ifNull: ['$$item.qty', 1] }
                    ]
                  }
                }
              }
            },
            artisanCommissionTotal: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: { $ifNull: ['$$item.artisanCommissionAmount', 0] }
                }
              }
            },
            quantityTotal: {
              $sum: {
                $map: {
                  input: { $ifNull: ['$items', []] },
                  as: 'item',
                  in: { $ifNull: ['$$item.qty', 0] }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: '$quantityTotal' },
            totalRevenue: { $sum: { $ifNull: ['$subtotal', 0] } },
            totalCostPrice: { $sum: '$itemCostTotal' },
            totalArtisanCommission: { $sum: '$artisanCommissionTotal' },
            totalGuideCommission: { $sum: { $ifNull: ['$guideCommissionAmount', 0] } },
            deliveryProfit: { $sum: { $ifNull: ['$delivery.storeProfit', 0] } }
          }
        },
        {
          $project: {
            _id: 0,
            totalQuantity: 1,
            totalRevenue: 1,
            totalCommissionExpenses: {
              $add: ['$totalArtisanCommission', '$totalGuideCommission']
            },
            netProfit: {
              $subtract: [
                '$totalRevenue',
                {
                  $add: [
                    '$totalCostPrice',
                    '$totalArtisanCommission',
                    '$totalGuideCommission'
                  ]
                }
              ]
            },
            deliveryProfit: 1
          }
        }
      ]),

      PosOrder.aggregate([
        { $match: match },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.itemName',
            totalQuantity: { $sum: { $ifNull: ['$items.qty', 0] } }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            productName: '$_id',
            totalQuantity: 1
          }
        }
      ]),

      PosOrder.aggregate([
        {
          $match: {
            ...match,
            guideName: {
              $nin: ['', null]
            }
          }
        },
        {
          $group: {
            _id: '$guideName',
            totalSales: { $sum: { $ifNull: ['$subtotal', 0] } }
          }
        },
        { $sort: { totalSales: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            tourGuide: '$_id',
            totalSales: 1
          }
        }
      ]),

      PosOrder.aggregate([
        { $match: match },
        { $unwind: '$items' },
        {
          $match: {
            'items.artisanName': {
              $nin: ['', null]
            }
          }
        },
        {
          $group: {
            _id: '$items.artisanName',
            totalQuantity: { $sum: { $ifNull: ['$items.qty', 0] } }
          }
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            artisanName: '$_id',
            totalQuantity: 1
          }
        }
      ])
    ]);

    const [totals] = totalsResult;

    const summary = {
      totalQuantity: totals?.totalQuantity || 0,
      totalRevenue: totals?.totalRevenue || 0,
      totalCommissionExpenses: totals?.totalCommissionExpenses || 0,
      netProfit: totals?.netProfit || 0,
      deliveryProfit: totals?.deliveryProfit || 0,
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

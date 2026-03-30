const MasterProduct = require('../models/MasterProduct');
const ProductItem = require('../models/ProductItem');

exports.getCategories = async (req, res) => {
  try {
    const { search = '' } = req.query;

    const query = {};

    if (String(search).trim()) {
      query.productName = {
        $regex: String(search).trim(),
        $options: 'i'
      };
    }

    query.status = 'active';

    const [masterProducts, productItemCounts] = await Promise.all([
      MasterProduct.find(query)
        .select('_id categoryName productName logo status createdAt updatedAt')
        .sort({ createdAt: -1 })
        .lean(),

      ProductItem.aggregate([
        {
          $match: {
            status: 'available'
          }
        },
        {
          $group: {
            _id: '$masterProductId',
            productCount: { $sum: 1 }
          }
        }
      ])
    ]);
    
    const productItemCountMap = new Map(
      productItemCounts.map((item) => [
        String(item._id),
        Number(item.productCount || 0)
      ])
    );

    const data = masterProducts.map((masterProduct) => ({
      _id: masterProduct._id,
      name: masterProduct.productName || '',
      productName: masterProduct.productName || '',
      categoryName: masterProduct.categoryName || '',
      logo: masterProduct.logo || '',
      status: masterProduct.status || 'active',
      productCount: productItemCountMap.get(String(masterProduct._id)) || 0,
      createdAt: masterProduct.createdAt,
      updatedAt: masterProduct.updatedAt
    }));

    return res.status(200).json({
      success: true,
      count: data.length,
      data
    });
  } catch (error) {
    console.error('getCategories error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};
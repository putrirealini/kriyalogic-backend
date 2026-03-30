const ExcelJS = require('exceljs');
const Artisan = require('../models/Artisan');
const ProductItem = require('../models/ProductItem');
const ArtisanCommission = require('../models/ArtisanCommission');
const mongoose = require('mongoose');

// @desc    Create new artisan
// @route   POST /api/v1/artisans
// @access  Private/Admin
exports.createArtisan = async (req, res) => {
  try {
    const { fullName, phoneNumber, commissionRate, bankAccount, address, status } = req.body;

    // Validate inputs
    if (!fullName || !phoneNumber || !commissionRate || !bankAccount || !address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if phone number already exists
    const artisanExists = await Artisan.findOne({ phoneNumber });
    if (artisanExists) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }

    const artisan = await Artisan.create({
      fullName,
      phoneNumber,
      commissionRate,
      bankAccount,
      address,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: artisan
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update artisan
// @route   PUT /api/v1/artisans/:id
// @access  Private/Admin
exports.updateArtisan = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid artisan ID'
      });
    }

    const artisan = await Artisan.findById(req.params.id);

    if (!artisan) {
      return res.status(404).json({
        success: false,
        message: 'Artisan not found'
      });
    }

    const { fullName, phoneNumber, commissionRate, bankAccount, address, status } = req.body;

    // Check if phone number is being updated and if it's already taken
    if (phoneNumber && phoneNumber !== artisan.phoneNumber) {
      const artisanExists = await Artisan.findOne({ phoneNumber });
      if (artisanExists) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
      artisan.phoneNumber = phoneNumber;
    }

    if (fullName) artisan.fullName = fullName;
    if (commissionRate) artisan.commissionRate = commissionRate;
    if (bankAccount) artisan.bankAccount = bankAccount;
    if (address) artisan.address = address;
    if (status) artisan.status = status;

    await artisan.save();

    res.status(200).json({
      success: true,
      data: artisan
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Delete artisan
// @route   DELETE /api/v1/artisans/:id
// @access  Private/Admin
exports.deleteArtisan = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid artisan ID'
      });
    }

    const artisan = await Artisan.findById(req.params.id);

    if (!artisan) {
      return res.status(404).json({
        success: false,
        message: 'Artisan not found'
      });
    }

    await artisan.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Artisan deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get all artisans
// @route   GET /api/v1/artisans
// @access  Private/Admin
exports.getArtisans = async (req, res) => {
  try {
    const artisans = await Artisan.find({status: 'active'}).lean();

    if (!artisans.length) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: []
      });
    }

    const artisanIds = artisans.map((artisan) => artisan._id);

    const [productSummary, pendingPayoutSummary] = await Promise.all([
      ProductItem.aggregate([
        {
          $match: {
            artisanId: { $in: artisanIds }
          }
        },
        {
          $lookup: {
            from: 'masterproducts',
            localField: 'masterProductId',
            foreignField: '_id',
            as: 'masterProduct'
          }
        },
        {
          $unwind: {
            path: '$masterProduct',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $group: {
            _id: '$artisanId',
            products: {
              $push: {
                _id: '$_id',
                masterProductId: '$masterProductId',
                name: '$itemName',
                code: '$childCode',
                price: '$sellingPrice',
                stock: 1,
                status: '$status',
                productPhoto: '$productPhoto',
                masterProductName: '$masterProduct.productName',
                categoryName: '$masterProduct.categoryName'
              }
            },
            productCount: { $sum: 1 }
          }
        }
      ]),

      ArtisanCommission.aggregate([
        {
          $match: {
            artisanId: { $in: artisanIds },
            status: 'unpaid'
          }
        },
        {
          $group: {
            _id: '$artisanId',
            totalPendingPayout: { $sum: '$commissionAmount' }
          }
        }
      ])
    ]);

    const productSummaryMap = new Map(
      productSummary.map((item) => [String(item._id), item])
    );

    const pendingPayoutMap = new Map(
      pendingPayoutSummary.map((item) => [
        String(item._id),
        Number(item.totalPendingPayout || 0)
      ])
    );

    const data = artisans.map((artisan) => {
      const summary = productSummaryMap.get(String(artisan._id));

      return {
        ...artisan,
        productCount: summary?.productCount || 0,
        products: summary?.products || [],
        totalPendingPayout: pendingPayoutMap.get(String(artisan._id)) || 0
      };
    });

    return res.status(200).json({
      success: true,
      count: artisans.length,
      data
    });
  } catch (error) {
    console.error('getArtisans error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

exports.getArtisanCommissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { search, status, fromDate, toDate } = req.query;

    const query = { artisanId: id };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && String(search).trim()) {
      const keyword = String(search).trim();

      query.$or = [
        { itemName: { $regex: keyword, $options: 'i' } },
        { childCode: { $regex: keyword, $options: 'i' } }
      ];
    }

    if (fromDate || toDate) {
      query.createdAt = {};

      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }

      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const data = await ArtisanCommission.find(query)
      .populate({
        path: 'productItemId',
        select: 'itemName childCode productPhoto sellingPrice status masterProductId artisanId'
      })
      .sort({ createdAt: -1 })
      .lean();

    const totalPending = data
      .filter((i) => i.status === 'unpaid')
      .reduce((sum, i) => sum + Number(i.commissionAmount || 0), 0);

    const mappedData = data.map((item) => ({
      ...item,
      productItem: item.productItemId || null,
      productPhoto: item.productPhoto || item.productItemId?.productPhoto || '',
      itemName: item.productItemId?.itemName || '',
      childCode: item.childCode || item.productItemId?.childCode || '',
      sellingPrice: item.sellingPrice || item.productItemId?.sellingPrice || 0,
      statusProduct: item.productItemId?.status || null
    }));

    return res.json({
      success: true,
      data: mappedData,
      totalPending
    });
  } catch (err) {
    console.error('getArtisanCommissions error:', err);

    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

exports.markAllPaid = async (req, res) => {
  const { id } = req.params;

  await ArtisanCommission.updateMany(
    { artisanId: id, status: 'unpaid' },
    {
      $set: {
        status: 'paid',
        paidAt: new Date()
      }
    }
  );

  res.json({ success: true });
};

exports.markSelectedPaid = async (req, res) => {
  try {
    const { artisanId, commissionIds = [] } = req.body;

    if (!artisanId) {
      return res.status(422).json({
        success: false,
        message: 'artisanId is required'
      });
    }

    if (!Array.isArray(commissionIds) || commissionIds.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'commissionIds is required'
      });
    }

    const result = await ArtisanCommission.updateMany(
      {
        _id: { $in: commissionIds },
        artisanId,
        status: 'unpaid'
      },
      {
        $set: {
          status: 'paid',
          paidAt: new Date(),
          paidBy: req.user?._id || null
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: 'Selected commissions marked as paid',
      data: {
        matchedCount: result.matchedCount ?? result.n,
        modifiedCount: result.modifiedCount ?? result.nModified
      }
    });
  } catch (error) {
    console.error('markSelectedPaid error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

exports.exportArtisanCommissionsExcel = async (req, res) => {
  try {
    const { id } = req.params;
    const { search, status, fromDate, toDate } = req.query;

    const artisan = await Artisan.findById(id).lean();

    if (!artisan) {
      return res.status(404).json({
        success: false,
        message: 'Artisan not found'
      });
    }

    const query = { artisanId: id };

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && String(search).trim()) {
      const keyword = String(search).trim();

      query.$or = [
        { itemName: { $regex: keyword, $options: 'i' } },
        { childCode: { $regex: keyword, $options: 'i' } }
      ];
    }

    if (fromDate || toDate) {
      query.createdAt = {};

      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }

      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const commissions = await ArtisanCommission.find(query)
      .sort({ createdAt: -1 })
      .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Artisan Commission');

    worksheet.columns = [
      { header: 'No', key: 'no', width: 8 },
      { header: 'Date Of Commission', key: 'createdAt', width: 20 },
      { header: 'Date Paid', key: 'paidAt', width: 20 },
      { header: 'Commission Amount', key: 'commissionAmount', width: 20 },
      { header: 'Artisan', key: 'artisanName', width: 28 },
      { header: 'Product', key: 'itemName', width: 35 },
      { header: 'Child Code', key: 'childCode', width: 20 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    commissions.forEach((item, index) => {
      worksheet.addRow({
        no: index + 1,
        createdAt: item.createdAt ? new Date(item.createdAt) : '',
        paidAt: item.paidAt ? new Date(item.paidAt) : '',
        commissionAmount: Number(item.commissionAmount || 0),
        artisanName: artisan.fullName || artisan.name || '-',
        itemName: item.itemName || '-',
        childCode: item.childCode || '-',
        status: item.status || '-'
      });
    });

    worksheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: 'middle', horizontal: 'left' };

      if (rowNumber > 1) {
        row.getCell('D').numFmt = '"Rp." #,##0';
        row.getCell('B').numFmt = 'dd/mm/yyyy';
        row.getCell('C').numFmt = 'dd/mm/yyyy';
      }
    });

    const totalPending = commissions
      .filter((item) => item.status === 'unpaid')
      .reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0);

    const totalPaid = commissions
      .filter((item) => item.status === 'paid')
      .reduce((sum, item) => sum + Number(item.commissionAmount || 0), 0);

    const summarySheet = workbook.addWorksheet('Summary');

    summarySheet.columns = [
      { header: 'Keterangan', key: 'label', width: 28 },
      { header: 'Nilai', key: 'value', width: 30 }
    ];

    summarySheet.getRow(1).font = { bold: true };

    summarySheet.addRows([
      { label: 'Artisan', value: artisan.fullName || artisan.name || '-' },
      { label: 'Total Data', value: commissions.length },
      { label: 'Total Pending', value: totalPending },
      { label: 'Total Paid', value: totalPaid }
    ]);

    summarySheet.getCell('B3').numFmt = '0';
    summarySheet.getCell('B4').numFmt = '"Rp." #,##0';
    summarySheet.getCell('B5').numFmt = '"Rp." #,##0';

    const safeArtisanName = (artisan.fullName || artisan.name || 'artisan')
      .toString()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=artisan-commission-${safeArtisanName}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('exportArtisanCommissionsExcel error:', error);

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};
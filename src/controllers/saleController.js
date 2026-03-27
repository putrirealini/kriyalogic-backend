const mongoose = require('mongoose');
const SaleTransaction = require('../models/SaleTransaction');
const SaleItem = require('../models/SaleItem');
const ProductItem = require('../models/ProductItem');
const MasterProduct = require('../models/MasterProduct');
const Guide = require('../models/Guide');
const Artisan = require('../models/Artisan');
const asyncHandler = require('../middleware/asyncHandler');
const { generateReceiptNumber } = require('../utils/generateCode');

/**
 * Utility: sanitize sale response for cashier
 * Cashier should not see artisan confidential data like costPrice and artisan commission
 */
const sanitizeSaleItemForRole = (item, role) => {
  const obj = item.toObject ? item.toObject() : item;

  if (role === 'cashier') {
    delete obj.costPriceSnapshot;
    delete obj.artisanCommissionRateSnapshot;
    delete obj.artisanCommissionAmount;
  }

  return obj;
};

const sanitizeSaleTransactionDetailForRole = (transaction, role) => {
  const obj = transaction.toObject ? transaction.toObject() : transaction;

  if (role === 'cashier') {
    // guide commission boleh terlihat oleh kasir
    // artisan commission tidak ada di header, jadi aman
  }

  return obj;
};

/**
 * @desc    Checkout POS / finalize sale
 * @route   POST /api/sales/checkout
 * @access  Admin / Cashier
 *
 * body:
 * {
 *   "productItemIds": ["...","..."],
 *   "guideId": "...optional...",
 *   "discountAmount": 0,
 *   "paymentMethod": "cash",
 *   "paidAmount": 1000000,
 * }
 */
const checkoutSale = asyncHandler(async (req, res) => {
  const {
    productItemIds,
    guideId = null,
    discountAmount = 0,
    paymentMethod = 'cash',
    paidAmount,
  } = req.body;

  if (!Array.isArray(productItemIds) || productItemIds.length === 0) {
    return res.status(422).json({
      success: false,
      message: 'productItemIds is required and must be a non-empty array'
    });
  }

  const uniqueProductItemIds = [...new Set(productItemIds)];

  for (const id of uniqueProductItemIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(422).json({
        success: false,
        message: `Invalid product item id: ${id}`
      });
    }
  }

  if (guideId && !mongoose.Types.ObjectId.isValid(guideId)) {
    return res.status(422).json({
      success: false,
      message: 'Invalid guideId'
    });
  }

  if (paidAmount == null || Number(paidAmount) < 0) {
    return res.status(422).json({
      success: false,
      message: 'paidAmount is required and must be >= 0'
    });
  }

  const numericDiscount = Number(discountAmount || 0);
  const numericPaidAmount = Number(paidAmount);

  if (numericDiscount < 0) {
    return res.status(422).json({
      success: false,
      message: 'discountAmount cannot be negative'
    });
  }

  const session = await mongoose.startSession();

  let saleTransactionId = null;

  try {
    await session.withTransaction(async () => {
      let guide = null;

      if (guideId) {
        guide = await Guide.findById(guideId).session(session);
        if (!guide || guide.status !== 'active') {
          throw new Error('Active guide not found');
        }
      }

      const productItems = await ProductItem.find({
        _id: { $in: uniqueProductItemIds }
      })
        .populate('artisanId')
        .populate('masterProductId')
        .session(session);

      if (productItems.length !== uniqueProductItemIds.length) {
        throw new Error('Some product items were not found');
      }

      // Validate all items still available
      const unavailableItem = productItems.find((item) => item.status !== 'available');
      if (unavailableItem) {
        throw new Error(`Product item ${unavailableItem.childCode} is not available`);
      }

      const subtotal = productItems.reduce((sum, item) => sum + Number(item.sellingPrice), 0);
      const grandTotal = subtotal - numericDiscount;

      if (grandTotal < 0) {
        throw new Error('discountAmount cannot exceed subtotal');
      }

      if (numericPaidAmount < grandTotal) {
        throw new Error('paidAmount is less than grandTotal');
      }

      const guideCommissionRate = guide ? Number(guide.commissionRate || 0) : 0;
      const guideCommissionAmount = guide
        ? (subtotal * guideCommissionRate) / 100
        : 0;

      const receiptNumber = await generateReceiptNumber();

      const createdTransactions = await SaleTransaction.create(
        [
          {
            receiptNumber,
            cashierId: req.user._id,
            guideId: guide ? guide._id : null,
            guideNameSnapshot: guide ? guide.guideName : '',
            guideCommissionRateSnapshot: guideCommissionRate,
            guideCommissionAmount,
            subtotal,
            discountAmount: numericDiscount,
            grandTotal,
            paymentMethod,
            paidAmount: numericPaidAmount,
            changeAmount: numericPaidAmount - grandTotal,
            soldAt: new Date()
          }
        ],
        { session }
      );

      const saleTransaction = createdTransactions[0];
      saleTransactionId = saleTransaction._id;

      const saleItemsPayload = productItems.map((item) => {
        const artisanCommissionRate = Number(item.artisanId?.commissionRate || 0);
        const artisanCommissionAmount =
          (Number(item.costPrice) * artisanCommissionRate) / 100;

        return {
          saleTransactionId: saleTransaction._id,
          productItemId: item._id,
          masterProductId: item.masterProductId?._id,
          artisanId: item.artisanId?._id,
          parentCodeSnapshot: item.masterProductId?.parentCode || '',
          childCodeSnapshot: item.childCode,
          categoryNameSnapshot: item.masterProductId?.categoryName || '',
          productNameSnapshot: item.masterProductId?.productName || '',
          artisanNameSnapshot: item.artisanId?.fullName || '',
          costPriceSnapshot: Number(item.costPrice),
          sellingPriceSnapshot: Number(item.sellingPrice),
          artisanCommissionRateSnapshot: artisanCommissionRate,
          artisanCommissionAmount
        };
      });

      await SaleItem.insertMany(saleItemsPayload, { session });

      // Update product items status to sold
      const now = new Date();
      await ProductItem.updateMany(
        { _id: { $in: uniqueProductItemIds } },
        {
          $set: {
            status: 'sold',
            soldAt: now
          },
          $unset: {
            reservedAt: ''
          }
        },
        { session }
      );
    });

    const saleTransaction = await SaleTransaction.findById(saleTransactionId)
      .populate('cashierId', 'username email role')
      .populate('guideId', 'guideName agency contact commissionRate status');

    const saleItems = await SaleItem.find({ saleTransactionId })
      .populate('productItemId', 'childCode barcode status soldAt')
      .populate('masterProductId', 'parentCode categoryName productName slug status')
      .populate('artisanId', 'fullName phoneNumber status');

    return res.status(201).json({
      success: true,
      message: 'Checkout completed successfully',
      data: {
        transaction: sanitizeSaleTransactionDetailForRole(saleTransaction, req.user.role),
        items: saleItems.map((item) => sanitizeSaleItemForRole(item, req.user.role))
      }
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Checkout failed'
    });
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Receipt history list
 * @route   GET /api/sales/receipts
 * @access  Admin / Cashier
 */
const getReceiptHistory = asyncHandler(async (req, res) => {
  const {
    keyword = '',
    paymentMethod = '',
    dateFrom = '',
    dateTo = '',
    page = 1,
    limit = 10
  } = req.query;

  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.max(parseInt(limit, 10) || 10, 1);
  const skip = (currentPage - 1) * perPage;

  const filter = {};

  if (paymentMethod) {
    filter.paymentMethod = paymentMethod;
  }

  if (dateFrom || dateTo) {
    filter.soldAt = {};
    if (dateFrom) {
      filter.soldAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      filter.soldAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
    }
  }

  if (keyword.trim()) {
    const regex = { $regex: keyword.trim(), $options: 'i' };

    // cari transaction ids dari sale items
    const matchedSaleItems = await SaleItem.find({
      $or: [
        { childCodeSnapshot: regex },
        { productNameSnapshot: regex },
        { artisanNameSnapshot: regex }
      ]
    }).select('saleTransactionId');

    const saleTransactionIds = matchedSaleItems.map((item) => item.saleTransactionId);

    filter.$or = [
      { receiptNumber: regex },
      { guideNameSnapshot: regex },
      { _id: { $in: saleTransactionIds } }
    ];
  }

  const [transactions, total] = await Promise.all([
    SaleTransaction.find(filter)
      .populate('cashierId', 'username email role')
      .populate('guideId', 'guideName agency contact commissionRate status')
      .sort({ soldAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(perPage),
    SaleTransaction.countDocuments(filter)
  ]);

  const transactionIds = transactions.map((trx) => trx._id);

  const itemCounts = await SaleItem.aggregate([
    {
      $match: {
        saleTransactionId: { $in: transactionIds }
      }
    },
    {
      $group: {
        _id: '$saleTransactionId',
        totalItems: { $sum: 1 }
      }
    }
  ]);

  const itemCountMap = new Map(itemCounts.map((item) => [String(item._id), item.totalItems]));

  const result = transactions.map((trx) => {
    const obj = sanitizeSaleTransactionDetailForRole(trx, req.user.role);
    return {
      ...obj,
      totalItems: itemCountMap.get(String(trx._id)) || 0
    };
  });

  return res.status(200).json({
    success: true,
    message: 'Receipt history fetched successfully',
    data: result,
    meta: {
      page: currentPage,
      limit: perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  });
});

/**
 * @desc    Receipt detail
 * @route   GET /api/sales/receipts/:id
 * @access  Admin / Cashier
 */
const getReceiptDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(422).json({
      success: false,
      message: 'Invalid receipt id'
    });
  }

  const transaction = await SaleTransaction.findById(id)
    .populate('cashierId', 'username email role')
    .populate('guideId', 'guideName agency contact commissionRate status');

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Receipt not found'
    });
  }

  const items = await SaleItem.find({ saleTransactionId: transaction._id })
    .populate('productItemId', 'childCode barcode status soldAt')
    .populate('masterProductId', 'parentCode categoryName productName slug status')
    .populate('artisanId', 'fullName phoneNumber status')
    .sort({ createdAt: 1 });

  return res.status(200).json({
    success: true,
    message: 'Receipt detail fetched successfully',
    data: {
      transaction: sanitizeSaleTransactionDetailForRole(transaction, req.user.role),
      items: items.map((item) => sanitizeSaleItemForRole(item, req.user.role))
    }
  });
});

/**
 * @desc    Receipt detail by receipt number
 * @route   GET /api/sales/receipts/number/:receiptNumber
 * @access  Admin / Cashier
 */
const getReceiptDetailByNumber = asyncHandler(async (req, res) => {
  const { receiptNumber } = req.params;

  const transaction = await SaleTransaction.findOne({ receiptNumber })
    .populate('cashierId', 'username email role')
    .populate('guideId', 'guideName agency contact commissionRate status');

  if (!transaction) {
    return res.status(404).json({
      success: false,
      message: 'Receipt not found'
    });
  }

  const items = await SaleItem.find({ saleTransactionId: transaction._id })
    .populate('productItemId', 'childCode barcode status soldAt')
    .populate('masterProductId', 'parentCode categoryName productName slug status')
    .populate('artisanId', 'fullName phoneNumber status')
    .sort({ createdAt: 1 });

  return res.status(200).json({
    success: true,
    message: 'Receipt detail fetched successfully',
    data: {
      transaction: sanitizeSaleTransactionDetailForRole(transaction, req.user.role),
      items: items.map((item) => sanitizeSaleItemForRole(item, req.user.role))
    }
  });
});

module.exports = {
  checkoutSale,
  getReceiptHistory,
  getReceiptDetail,
  getReceiptDetailByNumber
};
const mongoose = require('mongoose');

const MasterProduct = require('../models/MasterProduct');
const ProductItem = require('../models/ProductItem');
const PosOrder = require('../models/PosOrder');
const Guide = require('../models/Guide');
const ArtisanCommission = require('../models/ArtisanCommission');
const asyncHandler = require('../middleware/asyncHandler');
const generateReceiptNumber = require('../utils/generateReceiptNumber');

const TAX_PERCENT = 5;

exports.getProducts = asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 10 } = req.query;

  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.max(parseInt(limit, 10) || 10, 1);

  const query = {};

  if (search && String(search).trim()) {
    const keyword = String(search).trim();

    query.$or = [
      { itemName: { $regex: keyword, $options: 'i' } },
      { childCode: { $regex: keyword, $options: 'i' } },
      { barcode: { $regex: keyword, $options: 'i' } }
    ];
  }

  query.status = 'available';

  const normalizedCategory = category !== undefined && category !== null
    ? String(category).trim()
    : '';

  const shouldFilterCategory =
    normalizedCategory !== '' &&
    normalizedCategory.toLowerCase() !== 'all';

  if (shouldFilterCategory) {
    const masterProducts = await MasterProduct.find({
      productName: normalizedCategory
    }).select('_id');

    const masterProductIds = masterProducts.map((item) => item._id);

    query.masterProductId = { $in: masterProductIds };
  }

  const skip = (currentPage - 1) * perPage;

  const [products, total] = await Promise.all([
    ProductItem.find(query)
      .populate('masterProductId', 'productName categoryName logo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(perPage),
    ProductItem.countDocuments(query)
  ]);

  res.status(200).json({
    success: true,
    count: products.length,
    total,
    page: currentPage,
    pages: Math.ceil(total / perPage),
    data: products
  });
});

exports.getTourGuides = asyncHandler(async (req, res) => {
  try {
      const guides = await Guide.find({ status: 'active' });
      res.status(200).json({
        success: true,
        count: guides.length,
        data: guides
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Server Error',
        error: error.message
      });
    }
});

exports.payNow = asyncHandler(async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      customerName = '',
      customerPhone = '',
      paymentMethod,
      itemIds = [],
      guideId = null,
      deliveryFee = 0,
      discount = 0,
      amountPaid = 0
    } = req.body;

    if (!['cash', 'card', 'qris'].includes(paymentMethod)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid payment method'
      });
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(422).json({
        success: false,
        message: 'At least one product item must be selected'
      });
    }

    const uniqueItemIds = [...new Set(itemIds.map((id) => String(id)))];

    const numericDeliveryFee = Number(deliveryFee || 0);
    const numericDiscount = Number(discount || 0);
    const numericAmountPaid = Number(amountPaid || 0);

    if (Number.isNaN(numericDeliveryFee) || numericDeliveryFee < 0) {
      return res.status(422).json({
        success: false,
        message: 'Invalid delivery fee'
      });
    }

    if (Number.isNaN(numericDiscount) || numericDiscount < 0) {
      return res.status(422).json({
        success: false,
        message: 'Invalid discount'
      });
    }

    await session.withTransaction(async () => {
      const productItems = await ProductItem.find({
        _id: { $in: uniqueItemIds }
      })
        .populate('masterProductId', 'productName categoryName logo')
        .populate('artisanId', 'fullName commissionRate')
        .session(session);

      if (productItems.length !== uniqueItemIds.length) {
        const error = new Error('Some selected items were not found');
        error.statusCode = 404;
        throw error;
      }

      const soldItems = productItems.filter((item) => item.status === 'sold');
      if (soldItems.length > 0) {
        const error = new Error('Some selected items are already sold');
        error.statusCode = 409;
        error.payload = {
          soldItemIds: soldItems.map((item) => item._id)
        };
        throw error;
      }

      let guide = null;
      let guideCommissionRate = 0;

      if (guideId) {
        if (!mongoose.Types.ObjectId.isValid(guideId)) {
          const error = new Error('Invalid guide id');
          error.statusCode = 422;
          throw error;
        }

        guide = await Guide.findById(guideId).session(session);

        if (!guide) {
          const error = new Error('Guide not found');
          error.statusCode = 404;
          throw error;
        }

        guideCommissionRate = Number(guide.commissionRate || 0);
      }

      const orderItems = productItems.map((item) => {
        const price = Number(item.sellingPrice || 0);
        const artisanCommissionRate = Number(item.artisanId?.commissionRate || 0);

        return {
          productItemId: item._id,
          masterProductId: item.masterProductId?._id || null,
          artisanId: item.artisanId?._id || null,
          artisanName: item.artisanId?.fullName || '',
          artisanCommissionRate,
          itemName:
            item.itemName ||
            item.masterProductId?.productName ||
            'Unnamed Product',
          childCode: item.childCode || '',
          image: item.productPhoto || item.masterProductId?.logo || '',
          qty: 1,
          price,
          subtotal: price
        };
      });

      const subtotal = orderItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
      const taxAmount = (subtotal * TAX_PERCENT) / 100;
      const guideCommissionAmount = (subtotal * guideCommissionRate) / 100;

      const totalAmount =
        subtotal +
        taxAmount +
        numericDeliveryFee -
        numericDiscount +
        guideCommissionAmount;

      let finalAmountPaid = totalAmount;
      let changeAmount = 0;

      if (paymentMethod === 'cash') {
        if (Number.isNaN(numericAmountPaid) || numericAmountPaid < totalAmount) {
          const error = new Error('Amount paid is insufficient');
          error.statusCode = 422;
          error.payload = {
            totalAmount,
            amountPaid: numericAmountPaid
          };
          throw error;
        }

        finalAmountPaid = numericAmountPaid;
        changeAmount = numericAmountPaid - totalAmount;
      }

      const receiptNumber = await generateReceiptNumber(session);

      const createdOrders = await PosOrder.create(
        [
          {
            receiptNumber,
            customerName: String(customerName).trim(),
            customerPhone: String(customerPhone).trim(),
            cashierId: req.user?._id || null,
            cashierName: req.user?.username || req.user?.name || '',
            guideId: guide?._id || null,
            guideName: guide?.fullName || guide?.name || '',
            guideCommissionRate,
            guideCommissionAmount,
            items: orderItems,
            subtotal,
            taxPercent: TAX_PERCENT,
            taxAmount,
            deliveryFee: numericDeliveryFee,
            discount: numericDiscount,
            totalAmount,
            paymentMethod,
            amountPaid: finalAmountPaid,
            changeAmount,
            status: 'paid',
            paidAt: new Date()
          }
        ],
        { session }
      );

      const order = createdOrders[0];

      await ProductItem.updateMany(
        { _id: { $in: uniqueItemIds } },
        {
          $set: {
            status: 'sold',
            soldAt: new Date()
          }
        },
        { session }
      );

      const commissionInserts = orderItems
        .map((item) => {
          if (!item.artisanId) return null;

          const commissionRate = Number(item.artisanCommissionRate || 0);
          const commissionAmount = (Number(item.price || 0) * commissionRate) / 100;

          return {
            artisanId: item.artisanId,
            productItemId: item.productItemId,
            orderId: order._id,
            itemName: item.itemName,
            childCode: item.childCode,
            productPhoto: item.image || '',
            sellingPrice: Number(item.price || 0),
            commissionRate,
            commissionAmount,
            status: 'unpaid',
            paidAt: null,
            paidBy: null
          };
        })
        .filter(Boolean);

      if (commissionInserts.length > 0) {
        await ArtisanCommission.insertMany(commissionInserts, { session });
      }

      return res.status(201).json({
        success: true,
        message: 'Payment successful',
        data: {
          orderId: order._id,
          receiptNumber: order.receiptNumber,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          cashierName: order.cashierName,
          guideName: order.guideName,
          guideCommissionRate: order.guideCommissionRate,
          guideCommissionAmount: order.guideCommissionAmount,
          items: order.items,
          subtotal: order.subtotal,
          taxPercent: order.taxPercent,
          taxAmount: order.taxAmount,
          deliveryFee: order.deliveryFee,
          discount: order.discount,
          totalAmount: order.totalAmount,
          paymentMethod: order.paymentMethod,
          amountPaid: order.amountPaid,
          changeAmount: order.changeAmount,
          paidAt: order.paidAt
        }
      });
    });
  } catch (error) {
    console.error(error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: error.payload || null
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate receipt number detected'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  } finally {
    await session.endSession();
  }
});

exports.getReceiptHistories = asyncHandler(async (req, res) => {
  const { search = '', page = 1, limit = 10 } = req.query;

  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const perPage = Math.max(parseInt(limit, 10) || 10, 1);
  const skip = (currentPage - 1) * perPage;

  const keyword = String(search).trim();
  const query = {};

  if (keyword) {
    query.$or = [
      { receiptNumber: { $regex: keyword, $options: 'i' } },
      { customerName: { $regex: keyword, $options: 'i' } },
      { cashierName: { $regex: keyword, $options: 'i' } },
      { paymentMethod: { $regex: keyword, $options: 'i' } }
    ];
  }

  const [orders, total] = await Promise.all([
    PosOrder.find(query)
      .select({
        receiptNumber: 1,
        customerName: 1,
        customerPhone: 1,
        cashierName: 1,
        guideName: 1,
        guideCommissionAmount: 1,
        subtotal: 1,
        taxPercent: 1,
        taxAmount: 1,
        deliveryFee: 1,
        discount: 1,
        totalAmount: 1,
        paymentMethod: 1,
        amountPaid: 1,
        changeAmount: 1,
        status: 1,
        paidAt: 1,
        createdAt: 1,
        items: 1
      })
      .sort({ paidAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(perPage)
      .allowDiskUse(true)
      .lean(),
    PosOrder.countDocuments(query)
  ]);

  const data = orders.map((order) => ({
    _id: order._id,
    receiptNumber: order.receiptNumber,
    customerName: order.customerName || '-',
    customerPhone: order.customerPhone || '',
    cashierName: order.cashierName || '-',
    guideName: order.guideName || '',
    guideCommissionAmount: Number(order.guideCommissionAmount || 0),
    subtotal: Number(order.subtotal || 0),
    taxPercent: Number(order.taxPercent || 0),
    taxAmount: Number(order.taxAmount || 0),
    deliveryFee: Number(order.deliveryFee || 0),
    discount: Number(order.discount || 0),
    totalAmount: Number(order.totalAmount || 0),
    paymentMethod: order.paymentMethod || '-',
    amountPaid: Number(order.amountPaid || 0),
    changeAmount: Number(order.changeAmount || 0),
    status: order.status || 'paid',
    paidAt: order.paidAt || order.createdAt,
    itemsCount: Array.isArray(order.items) ? order.items.length : 0
  }));

  res.status(200).json({
    success: true,
    count: data.length,
    total,
    page: currentPage,
    pages: Math.ceil(total / perPage),
    data
  });
});

exports.getReceiptHistoryDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const order = await PosOrder.findById(id).lean();

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Receipt not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      _id: order._id,
      receiptNumber: order.receiptNumber,
      customerName: order.customerName || '-',
      customerPhone: order.customerPhone || '',
      cashierName: order.cashierName || '-',
      guideName: order.guideName || '',
      guideCommissionRate: Number(order.guideCommissionRate || 0),
      guideCommissionAmount: Number(order.guideCommissionAmount || 0),
      subtotal: Number(order.subtotal || 0),
      taxPercent: Number(order.taxPercent || 0),
      taxAmount: Number(order.taxAmount || 0),
      deliveryFee: Number(order.deliveryFee || 0),
      discount: Number(order.discount || 0),
      totalAmount: Number(order.totalAmount || 0),
      paymentMethod: order.paymentMethod,
      amountPaid: Number(order.amountPaid || 0),
      changeAmount: Number(order.changeAmount || 0),
      status: order.status || 'paid',
      paidAt: order.paidAt || order.createdAt,
      items: Array.isArray(order.items) ? order.items : []
    }
  });
});
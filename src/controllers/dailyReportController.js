const PosOrder = require('../models/PosOrder');
const CashierRegisterClosure = require('../models/CashierRegisterClosure');
const asyncHandler = require('../middleware/asyncHandler');

const getSingleDateRange = (date) => {
  const now = new Date();
  const selectedDate = date
    ? new Date(`${date}T00:00:00.000Z`)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

  const startDate = new Date(selectedDate);
  const endDate = new Date(selectedDate);
  endDate.setUTCHours(23, 59, 59, 999);

  return { startDate, endDate };
};

exports.getDailyReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  const { startDate, endDate } = getSingleDateRange(date);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(422).json({
      success: false,
      message: 'Invalid date'
    });
  }

  const cashierId = req.user?._id;

  const orders = await PosOrder.find({
    status: 'paid',
    cashierId,
    paidAt: {
      $gte: startDate,
      $lte: endDate
    }
  }).lean();

  const invoiceCount = orders.length;

  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  const totalItemsSold = orders.reduce((sum, order) => {
    const itemQty = Array.isArray(order.items)
      ? order.items.reduce((itemSum, item) => itemSum + Number(item.qty || 0), 0)
      : 0;

    return sum + itemQty;
  }, 0);

  const netSalesToday = orders.reduce((sum, order) => sum + Number(order.subtotal || 0), 0);

  const cashSales = orders
    .filter((order) => order.paymentMethod === 'cash')
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  const qrisSales = orders
    .filter((order) => order.paymentMethod === 'qris')
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  const cardSales = orders
    .filter((order) => order.paymentMethod === 'card')
    .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

  const guideCommission = orders.reduce((sum, order) => {
    return sum + Number(order.guideCommissionAmount || 0);
  }, 0);

  const productCounter = {};
  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = item.itemName || 'Unnamed Product';
      productCounter[key] = (productCounter[key] || 0) + Number(item.qty || 0);
    });
  });

  let topSellingProduct = '-';
  let topSellingQty = 0;

  Object.entries(productCounter).forEach(([name, qty]) => {
    if (qty > topSellingQty) {
      topSellingProduct = name;
      topSellingQty = qty;
    }
  });

  const closure = await CashierRegisterClosure.findOne({
    cashierId,
    reportDate: {
      $gte: startDate,
      $lte: endDate
    }
  }).lean();

  const startingCash = 500000;
  const expectedDrawerCash = startingCash + cashSales;

  const report = {
    cashier: {
      name: req.user?.username || req.user?.name || '-',
      shift: 'Morning Shift (08:00 - 17:00)'
    },
    netSalesToday,
    invoiceCount,
    totalItemsSold,
    cashFlow: {
      startingCash,
      cashSales
    },
    drawerCash: {
      expected: expectedDrawerCash,
      actual: closure?.actualCash || 0
    },
    totalRevenue,
    topSellingProduct,
    guideCommission,
    paymentBreakdown: {
      cash: cashSales,
      qris: qrisSales,
      card: cardSales
    },
    registerClosure: {
      isClosed: Boolean(closure),
      actualCash: closure?.actualCash || 0,
      cashierNotes: closure?.cashierNotes || '',
      closedAt: closure?.closedAt || null,
      verifiedBy: closure?.cashierName || req.user?.username || req.user?.name || '-'
    }
  };

  return res.status(200).json({
    success: true,
    message: 'Daily report fetched successfully',
    data: report
  });
});

exports.closeRegister = asyncHandler(async (req, res) => {
  const { date, actualCash, cashierNotes = '' } = req.body;
  const { startDate, endDate } = getSingleDateRange(date);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return res.status(422).json({
      success: false,
      message: 'Invalid date'
    });
  }

  const cashierId = req.user?._id;
  const numericActualCash = Number(actualCash || 0);

  if (Number.isNaN(numericActualCash) || numericActualCash < 0) {
    return res.status(422).json({
      success: false,
      message: 'Actual cash must be a valid number'
    });
  }

  const existingClosure = await CashierRegisterClosure.findOne({
    cashierId,
    reportDate: {
      $gte: startDate,
      $lte: endDate
    }
  });

  if (existingClosure) {
    return res.status(409).json({
      success: false,
      message: 'Register already closed for this date'
    });
  }

  const closure = await CashierRegisterClosure.create({
    cashierId,
    cashierName: req.user?.username || req.user?.name || '-',
    reportDate: startDate,
    actualCash: numericActualCash,
    cashierNotes: String(cashierNotes || '').trim(),
    closedAt: new Date()
  });

  return res.status(201).json({
    success: true,
    message: 'Register closed successfully',
    data: closure
  });
});
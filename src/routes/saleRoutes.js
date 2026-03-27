const express = require('express');
const router = express.Router();

const {
  checkoutSale,
  getReceiptHistory,
  getReceiptDetail,
  getReceiptDetailByNumber
} = require('../controllers/saleController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

router.post('/checkout', checkoutSale);

router.get('/receipts', getReceiptHistory);
router.get('/receipts/number/:receiptNumber', getReceiptDetailByNumber);
router.get('/receipts/:id', getReceiptDetail);

module.exports = router;
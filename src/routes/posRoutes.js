const express = require('express');

const { getProducts, getTourGuides, payNow, getReceiptHistories, getReceiptHistoryDetail } = require('../controllers/posController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'cashier'));

router.get('/items', getProducts);
router.get('/tour-guides', getTourGuides);
router.post('/checkout', payNow);
router.get('/receipt-histories', getReceiptHistories);
router.get('/receipt-histories/:id', getReceiptHistoryDetail);

module.exports = router;
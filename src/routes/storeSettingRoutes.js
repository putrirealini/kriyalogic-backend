const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

const {
  getStoreSetting,
  getReceiptDetail,
  updateStoreSetting
} = require('../controllers/storeSettingController');

router.use(protect);

router.get('/receipt-detail', authorize('admin', 'cashier'), getReceiptDetail);
router.get('/', authorize('admin'), getStoreSetting);
router.put('/', authorize('admin'), updateStoreSetting);

module.exports = router;

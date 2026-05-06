const express = require('express');

const {
  getDailyReport,
  closeRegister
} = require('../controllers/dailyReportController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('cashier'));

router.get('/', getDailyReport);
router.post('/close-register', closeRegister);

module.exports = router;
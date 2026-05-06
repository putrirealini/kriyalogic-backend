const express = require('express');
const router = express.Router();

const {
  getDeliveryData,
  getCouriers,
  updateDeliverySchedule
} = require('../controllers/deliveryController');

const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('cashier'));

router.get('/data', getDeliveryData);
router.get('/get-couriers', getCouriers);
router.put('/:id/schedule', updateDeliverySchedule);

module.exports = router;
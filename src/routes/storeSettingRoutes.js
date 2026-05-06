const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

const {
  getStoreSetting,
  updateStoreSetting
} = require('../controllers/storeSettingController');

router.use(protect);
router.use(authorize('admin'));

router.get('/', getStoreSetting);
router.put('/', updateStoreSetting);

module.exports = router;
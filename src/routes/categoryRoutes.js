const express = require('express');
// const { createMasterProductWithFirstChild, addChildItemToMasterProduct, getParentProducts, getMasterProductDetail } = require('../controllers/masterProductController');
const { getCategories } = require('../controllers/categoryController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'cashier'));

router.get('/', getCategories);

module.exports = router;
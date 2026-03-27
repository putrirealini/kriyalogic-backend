const express = require('express');
const { getParentProducts, createParentProduct, getParentProductDetail, updateParentProduct, deleteParentProduct, addChildItemToMasterProduct } = require('../controllers/masterProductController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'cashier'));

router.get('/', getParentProducts);
router.get('/:id', getParentProductDetail);

router.use(authorize('admin'));
router.post('/', createParentProduct);
router.put('/:id', updateParentProduct);
router.delete('/:id', deleteParentProduct);

router.post('/:id/child-items', addChildItemToMasterProduct);

module.exports = router;
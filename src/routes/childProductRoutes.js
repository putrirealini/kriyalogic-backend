const express = require('express');
const { getChildItems, updateChildItem, deleteChildItem } = require('../controllers/childProductController');

const router = express.Router();

const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

router.get('/:id', getChildItems);
router.put('/:id', updateChildItem);
router.delete('/:id', deleteChildItem);

module.exports = router;
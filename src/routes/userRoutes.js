const express = require('express');
const { createCashier, getCashiers, deleteCashier, updateCashier } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(authorize('admin'));

router.post('/cashier', createCashier);
router.get('/cashiers', getCashiers);
router.put('/cashier/:id', updateCashier);
router.delete('/cashier/:id', deleteCashier);

module.exports = router;

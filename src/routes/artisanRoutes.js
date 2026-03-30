const express = require('express');
const { createArtisan, getArtisans, updateArtisan, deleteArtisan, getArtisanCommissions, markAllPaid, exportArtisanCommissionsExcel, markSelectedPaid } = require('../controllers/artisanController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(authorize('admin'));

router.post('/', createArtisan);
router.get('/', getArtisans);
router.get('/:id/commissions', getArtisanCommissions);
router.put('/:id', updateArtisan);
router.post('/:id/mark-all-paid', markAllPaid);
router.post('/mark-selected-paid', markSelectedPaid);
router.delete('/:id', deleteArtisan);
router.get('/:id/commissions/export-excel', exportArtisanCommissionsExcel);

module.exports = router;

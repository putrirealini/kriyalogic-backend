const express = require('express');
const { createArtisan, getArtisans, updateArtisan, deleteArtisan } = require('../controllers/artisanController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(authorize('admin'));

router.post('/', createArtisan);
router.get('/', getArtisans);
router.put('/:id', updateArtisan);
router.delete('/:id', deleteArtisan);

module.exports = router;

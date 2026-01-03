const express = require('express');
const { createGuide, getGuides, updateGuide, deleteGuide } = require('../controllers/guideController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(authorize('admin'));

router.post('/', createGuide);
router.get('/', getGuides);
router.put('/:id', updateGuide);
router.delete('/:id', deleteGuide);

module.exports = router;

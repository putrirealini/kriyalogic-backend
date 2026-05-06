const express = require('express');
const { getAnalyticsSummary } = require('../controllers/analyticsController');

const router = express.Router();

// GET /api/v1/analytics/summary
router.get('/summary', getAnalyticsSummary);

module.exports = router;
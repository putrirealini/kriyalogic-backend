const express = require('express');
const router = express.Router();
const { getForecastByParentCode, getAvailableProducts } = require('../controllers/forecastController');

// GET /api/v1/forecast/products/list - Get available products
router.get('/products/list', getAvailableProducts);

// GET /api/v1/forecast/:parent_code - Get forecast data
router.get('/:parent_code', getForecastByParentCode);

module.exports = router;
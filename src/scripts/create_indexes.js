require('dotenv').config();

const mongoose = require('mongoose');

const ForecastResult = require('../models/ForecastResult');
const MasterProduct = require('../models/MasterProduct');
const PosOrder = require('../models/PosOrder');
const ProductItem = require('../models/ProductItem');

const createIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    await Promise.all([
      ForecastResult.createIndexes(),
      MasterProduct.createIndexes(),
      PosOrder.createIndexes(),
      ProductItem.createIndexes()
    ]);

    console.log('Indexes created successfully');
  } catch (error) {
    console.error('Failed to create indexes:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

createIndexes();

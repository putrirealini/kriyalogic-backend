const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const ForecastResult = require('../models/ForecastResult');
const MasterProduct = require('../models/MasterProduct');
require('dotenv').config();

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kriyalogic');
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection error:', error.message);
    process.exit(1);
  }
}

// Get all master products
async function getAllMasterProducts() {
  try {
    const products = await MasterProduct.find({});
    console.log(`✓ Found ${products.length} master products`);
    return products;
  } catch (error) {
    console.error('✗ Error fetching master products:', error.message);
    return [];
  }
}

// Seed Forecast Results
async function seedForecastResults() {
  const results = [];
  const masterProducts = await getAllMasterProducts();

  if (masterProducts.length === 0) {
    console.warn('⚠ No master products found. Using mock parent codes.');
  }

  // Get product codes for distribution
  const productCodes = masterProducts.length > 0 
    ? masterProducts.map(p => p.parentCode)
    : ['PB001', 'PG001', 'PN001', 'PGW001', 'PAM001', 'PBA001', 'PH001'];

  return new Promise((resolve, reject) => {
    let rowCount = 0;
    let productIndex = 0;

    fs.createReadStream('./df_mentah_prophet_pipeline.csv')
      .pipe(csv())
      .on('data', (data) => {
        try {
          const forecastDate = new Date(data['Tanggal']);
          const parentCode = productCodes[productIndex % productCodes.length];

          // Parse the amount (it's numeric already based on the CSV)
          const predictedDemand = parseInt(data['Total (Rp)']) || 0;
          
          // Create bounds (±15% of predicted value)
          const lowerBound = Math.round(predictedDemand * 0.85);
          const upperBound = Math.round(predictedDemand * 1.15);

          const record = {
            product_code: parentCode,
            forecast_date: forecastDate,
            predicted_demand: predictedDemand,
            lower_bound_estimate: lowerBound,
            upper_bound_estimate: upperBound,
            last_updated: new Date()
          };

          results.push(record);
          rowCount++;

          // Distribute across products
          if (rowCount % 20 === 0) {
            productIndex++;
          }
        } catch (error) {
          console.error(`✗ Error processing row:`, error.message);
        }
      })
      .on('end', async () => {
        try {
          if (results.length === 0) {
            console.warn('⚠ No forecast data to seed');
            resolve();
            return;
          }

          // Clear existing data
          const deleteResult = await ForecastResult.deleteMany({});
          console.log(`✓ Cleared ${deleteResult.deletedCount} existing forecast records`);

          // Insert new data
          const insertResult = await ForecastResult.insertMany(results);
          console.log(`✓ Seeded ${insertResult.length} forecast records`);
          console.log(`  - Data ranges from products: ${[...new Set(results.map(r => r.product_code))].join(', ')}`);
          console.log(`  - Date range: ${results[0].forecast_date.toLocaleDateString()} to ${results[results.length - 1].forecast_date.toLocaleDateString()}`);
          
          resolve();
        } catch (error) {
          console.error('✗ Error seeding forecast records:', error.message);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('✗ Error reading forecast CSV:', error.message);
        reject(error);
      });
  });
}

// Main seeding function
async function seedAll() {
  try {
    await connectDB();
    console.log('\n📊 Starting Forecast Data Seeding...\n');

    await seedForecastResults();

    console.log('\n✓ All forecast data seeded successfully!\n');
  } catch (error) {
    console.error('\n✗ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed\n');
  }
}

// Run the seeder
seedAll();

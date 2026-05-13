const fs = require('fs');
const csv = require('csv-parser');
const mongoose = require('mongoose');
const AnalyticsRecord = require('../models/AnalyticsRecord');
const DeliveryRecord = require('../models/DeliveryRecord');
require('dotenv').config();

// Helper function to clean monetary values
function cleanMonetaryValue(value) {
  if (!value || typeof value !== 'string') return 0;

  // Remove 'Rp', commas, spaces, and any non-numeric characters except decimal point
  let cleaned = value.replace(/Rp/g, '').replace(/,/g, '').replace(/\s/g, '').trim();

  // Parse to float
  const parsed = parseFloat(cleaned);

  // Return 0 if NaN
  return isNaN(parsed) ? 0 : parsed;
}

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kriyalogic');
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Seed Analytics Records
async function seedAnalyticsRecords() {
  const results = [];

  return new Promise((resolve, reject) => {
    const dataPath = require('path').resolve(__dirname, '../../data/KriyaLogic_Final_Analytics_Report_v2.csv');
    fs.createReadStream(dataPath)
      .pipe(csv())
      .on('data', (data) => {
        const record = {
          date: new Date(data['Tanggal']),
          productName: data['Nama Patung'],
          artisanName: data['Nama Artisan'],
          tourGuide: data['Tour Guide'],
          quantity: parseInt(data['Jumlah']) || 0,
          totalSales: cleanMonetaryValue(data['Total Sales (Rp)']),
          artisanCommission: cleanMonetaryValue(data['Artisan Commission (Rp)']),
          guideCommission: cleanMonetaryValue(data['Guide Commission (Rp)']),
          netProfit: cleanMonetaryValue(data['Net Profit (Rp)'])
        };
        results.push(record);
      })
      .on('end', async () => {
        try {
          await AnalyticsRecord.insertMany(results);
          console.log(`Seeded ${results.length} analytics records`);
          resolve();
        } catch (error) {
          console.error('Error seeding analytics records:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('Error reading analytics CSV:', error);
        reject(error);
      });
  });
}

// Seed Delivery Records
async function seedDeliveryRecords() {
  const results = [];

  return new Promise((resolve, reject) => {
    const dataPath = require('path').resolve(__dirname, '../../data/KriyaLogic_Delivery_Analytics_Premium_Price.csv');
    fs.createReadStream(dataPath)
      .pipe(csv())
      .on('data', (data) => {
        const record = {
          date: new Date(data['Tanggal']),
          productName: data['Nama Patung'],
          recipientName: data['Recipient Name'],
          originalCourierCost: cleanMonetaryValue(data['Original Courier Cost (Rp)']),
          storeProfit15Percent: cleanMonetaryValue(data['Store Profit (15%)']),
          totalShippingPrice: cleanMonetaryValue(data['Total Shipping Price (Rp)'])
        };
        results.push(record);
      })
      .on('end', async () => {
        try {
          await DeliveryRecord.insertMany(results);
          console.log(`Seeded ${results.length} delivery records`);
          resolve();
        } catch (error) {
          console.error('Error seeding delivery records:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('Error reading delivery CSV:', error);
        reject(error);
      });
  });
}

// Main seeding function
async function seedAll() {
  try {
    await connectDB();

    // Clear existing data (optional, uncomment if needed)
    // await AnalyticsRecord.deleteMany({});
    // await DeliveryRecord.deleteMany({});

    await seedAnalyticsRecords();
    await seedDeliveryRecords();

    console.log('All data seeded successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the seeder
seedAll();
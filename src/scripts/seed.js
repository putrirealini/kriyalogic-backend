const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: './.env' });

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

const seedUsers = async () => {
  try {
    await connectDB();

    // Check if users already exist
    const adminExists = await User.findOne({ email: 'admin@kriyalogic.com' });
    if (adminExists) {
      console.log('Admin user already exists');
    } else {
      await User.create({
        username: 'Admin User',
        email: 'admin@kriyalogic.com',
        password: 'password123',
        role: 'admin'
      });
      console.log('Admin user created');
    }

    const cashierExists = await User.findOne({ email: 'cashier@kriyalogic.com' });
    if (cashierExists) {
      console.log('Cashier user already exists');
    } else {
      await User.create({
        username: 'Cashier User',
        email: 'cashier@kriyalogic.com',
        password: 'password123',
        role: 'cashier'
      });
      console.log('Cashier user created');
    }

    console.log('Seeding completed');
    process.exit();
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

seedUsers();

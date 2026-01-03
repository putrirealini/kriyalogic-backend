const User = require('../models/User');
const mongoose = require('mongoose');

// @desc    Create cashier
// @route   POST /api/v1/users/cashier
// @access  Private/Admin
exports.createCashier = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate inputs
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email and password'
      });
    }

    // Check if email already exists
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      role: 'cashier',
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Delete cashier
// @route   DELETE /api/v1/users/cashier/:id
// @access  Private/Admin
exports.deleteCashier = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Ensure user is a cashier
    if (user.role !== 'cashier') {
      return res.status(400).json({
        success: false,
        message: 'User is not a cashier'
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Cashier deleted successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get all cashiers
// @route   GET /api/v1/users/cashiers
// @access  Private/Admin
exports.getCashiers = async (req, res) => {
  try {
    const cashiers = await User.find({ role: 'cashier' }).select('-password');

    res.status(200).json({
      success: true,
      count: cashiers.length,
      data: cashiers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update cashier
// @route   PUT /api/v1/users/cashier/:id
// @access  Private/Admin
exports.updateCashier = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID'
      });
    }

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Ensure user is a cashier
    if (user.role !== 'cashier') {
      return res.status(400).json({
        success: false,
        message: 'User is not a cashier'
      });
    }

    const { username, email, password, status } = req.body;

    // Check if email is being updated and if it's already taken
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
      user.email = email;
    }

    if (username) user.username = username;
    if (password) user.password = password;
    if (status) user.status = status;

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};


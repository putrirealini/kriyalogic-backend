const Artisan = require('../models/Artisan');
const mongoose = require('mongoose');

// @desc    Create new artisan
// @route   POST /api/v1/artisans
// @access  Private/Admin
exports.createArtisan = async (req, res) => {
  try {
    const { fullName, phoneNumber, commissionRate, bankAccount, address } = req.body;

    // Validate inputs
    if (!fullName || !phoneNumber || !commissionRate || !bankAccount || !address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Check if phone number already exists
    const artisanExists = await Artisan.findOne({ phoneNumber });
    if (artisanExists) {
      return res.status(400).json({
        success: false,
        message: 'Phone number already exists'
      });
    }

    const artisan = await Artisan.create({
      fullName,
      phoneNumber,
      commissionRate,
      bankAccount,
      address
    });

    res.status(201).json({
      success: true,
      data: artisan
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

// @desc    Update artisan
// @route   PUT /api/v1/artisans/:id
// @access  Private/Admin
exports.updateArtisan = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid artisan ID'
      });
    }

    const artisan = await Artisan.findById(req.params.id);

    if (!artisan) {
      return res.status(404).json({
        success: false,
        message: 'Artisan not found'
      });
    }

    const { fullName, phoneNumber, commissionRate, bankAccount, address } = req.body;

    // Check if phone number is being updated and if it's already taken
    if (phoneNumber && phoneNumber !== artisan.phoneNumber) {
      const artisanExists = await Artisan.findOne({ phoneNumber });
      if (artisanExists) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists'
        });
      }
      artisan.phoneNumber = phoneNumber;
    }

    if (fullName) artisan.fullName = fullName;
    if (commissionRate) artisan.commissionRate = commissionRate;
    if (bankAccount) artisan.bankAccount = bankAccount;
    if (address) artisan.address = address;

    await artisan.save();

    res.status(200).json({
      success: true,
      data: artisan
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

// @desc    Delete artisan
// @route   DELETE /api/v1/artisans/:id
// @access  Private/Admin
exports.deleteArtisan = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid artisan ID'
      });
    }

    const artisan = await Artisan.findById(req.params.id);

    if (!artisan) {
      return res.status(404).json({
        success: false,
        message: 'Artisan not found'
      });
    }

    await artisan.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Artisan deleted successfully'
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

// @desc    Get all artisans
// @route   GET /api/v1/artisans
// @access  Private/Admin
exports.getArtisans = async (req, res) => {
  try {
    const artisans = await Artisan.find();

    res.status(200).json({
      success: true,
      count: artisans.length,
      data: artisans
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

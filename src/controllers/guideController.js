const Guide = require('../models/Guide');
const mongoose = require('mongoose');

// @desc    Create new guide
// @route   POST /api/v1/guides
// @access  Private/Admin
exports.createGuide = async (req, res) => {
  try {
    const { guideName, agency, commissionRate, contact } = req.body;

    // Validate inputs
    if (!guideName || !agency || !commissionRate || !contact) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const guide = await Guide.create({
      guideName,
      agency,
      commissionRate,
      contact,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      data: guide
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

// @desc    Update guide
// @route   PUT /api/v1/guides/:id
// @access  Private/Admin
exports.updateGuide = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guide ID'
      });
    }

    const guide = await Guide.findById(req.params.id);

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Guide not found'
      });
    }

    const { guideName, agency, commissionRate, contact, status } = req.body;

    if (guideName) guide.guideName = guideName;
    if (agency) guide.agency = agency;
    if (commissionRate) guide.commissionRate = commissionRate;
    if (contact) guide.contact = contact;
    if (status) guide.status = status;

    await guide.save();

    res.status(200).json({
      success: true,
      data: guide
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

// @desc    Delete guide
// @route   DELETE /api/v1/guides/:id
// @access  Private/Admin
exports.deleteGuide = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid guide ID'
      });
    }

    const guide = await Guide.findById(req.params.id);

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Guide not found'
      });
    }

    await guide.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Guide deleted successfully'
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

// @desc    Get all guides
// @route   GET /api/v1/guides
// @access  Private/Admin
exports.getGuides = async (req, res) => {
  try {
    const guides = await Guide.find();

    res.status(200).json({
      success: true,
      count: guides.length,
      data: guides
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

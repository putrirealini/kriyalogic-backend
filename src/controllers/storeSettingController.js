const StoreSetting = require('../models/StoreSetting');

exports.getStoreSetting = async (req, res) => {
  try {
    let storeSetting = await StoreSetting.findOne()
      .populate('updatedBy', 'username email role');

    if (!storeSetting) {
      storeSetting = await StoreSetting.create({
        shopNameOnReceipt: '',
        slogan: '',
        storeAddress: '',
        footerGreeting: '',
        returnPolicyText: '',
        whatsappNumber: '',
        instagramUsername: '',
        isTaxed: false,
        logo: '',
        updatedBy: req.user?._id || null
      });

      storeSetting = await StoreSetting.findById(storeSetting._id)
        .populate('updatedBy', 'username email role');
    }

    return res.status(200).json({
      success: true,
      message: 'Store setting fetched successfully',
      data: storeSetting
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

exports.updateStoreSetting = async (req, res) => {
  try {
    const {
      shopNameOnReceipt,
      slogan,
      storeAddress,
      footerGreeting,
      returnPolicyText,
      whatsappNumber,
      instagramUsername,
      isTaxed,
      logo
    } = req.body;

    let storeSetting = await StoreSetting.findOne();

    if (!storeSetting) {
      storeSetting = new StoreSetting();
    }

    if (shopNameOnReceipt !== undefined) {
      storeSetting.shopNameOnReceipt = shopNameOnReceipt ? shopNameOnReceipt.trim() : '';
    }

    if (slogan !== undefined) {
      storeSetting.slogan = slogan ? slogan.trim() : '';
    }

    if (storeAddress !== undefined) {
      storeSetting.storeAddress = storeAddress ? storeAddress.trim() : '';
    }

    if (footerGreeting !== undefined) {
      storeSetting.footerGreeting = footerGreeting ? footerGreeting.trim() : '';
    }

    if (returnPolicyText !== undefined) {
      storeSetting.returnPolicyText = returnPolicyText ? returnPolicyText.trim() : '';
    }

    if (whatsappNumber !== undefined) {
      storeSetting.whatsappNumber = whatsappNumber ? whatsappNumber.trim() : '';
    }

    if (instagramUsername !== undefined) {
      storeSetting.instagramUsername = instagramUsername ? instagramUsername.trim() : '';
    }

    if (isTaxed !== undefined) {
      storeSetting.isTaxed = Boolean(isTaxed);
    }

    if (logo !== undefined) {
      storeSetting.logo = logo ? logo.trim() : '';
    }

    storeSetting.updatedBy = req.user?._id || null;

    await storeSetting.save();

    const updatedStoreSetting = await StoreSetting.findById(storeSetting._id)
      .populate('updatedBy', 'username email role');

    return res.status(200).json({
      success: true,
      message: 'Store setting updated successfully',
      data: updatedStoreSetting
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};
const mongoose = require('mongoose');

const PosOrder = require('../models/PosOrder');
const Courier = require('../models/Courier');
const asyncHandler = require('../middleware/asyncHandler');

const STORE_PROFIT_PERCENT = 15;

exports.getDeliveryData = asyncHandler(async (req, res) => {
  const orders = await PosOrder.find({
    $or: [
      { deliveryFee: { $gt: 0 } },
      { delivery: { $ne: null } }
    ]
  })
    .sort({ paidAt: -1, createdAt: -1 })
    .lean();

  const mappedOrders = orders.map((order) => {
    const firstItem = Array.isArray(order.items) && order.items.length > 0
      ? order.items[0]
      : null;

    const rawDelivery = order.delivery || null;

    const normalizedDelivery = rawDelivery
      ? {
          // packageName: rawDelivery.packageName || firstItem?.itemName || '',
          recipientName: rawDelivery.recipientName || order.customerName || '',
          destinationAddress: rawDelivery.destinationAddress || '',
          courierId: rawDelivery.courierId || null,
          courierName: rawDelivery.courierName || '',
          courierPartner: rawDelivery.courierName || '',
          pickupDateTime: rawDelivery.pickupDateTime || '',
          packageWeight: rawDelivery.packageWeight || '',
          courierPrice: Number(rawDelivery.courierPrice || 0),
          storeProfit: Number(rawDelivery.storeProfit || 0),
          totalPrice: Number(rawDelivery.totalPrice || order.deliveryFee || 0),
          trackingNumber: rawDelivery.trackingNumber || '',
          notes: rawDelivery.notes || '',
          status: rawDelivery.status || 'to_be_scheduled'
        }
      : {
          // packageName: firstItem?.itemName || '',
          recipientName: order.customerName || '',
          destinationAddress: '',
          courierId: null,
          courierName: '',
          courierPartner: '',
          pickupDateTime: '',
          packageWeight: '',
          courierPrice: 0,
          storeProfit: 0,
          totalPrice: Number(order.deliveryFee || 0),
          trackingNumber: '',
          notes: '',
          status: 'to_be_scheduled'
        };

    return {
      _id: order._id,
      receiptNumber: order.receiptNumber,
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      // itemName: firstItem?.itemName || 'Unnamed Product',
      itemName: rawDelivery?.packageName || firstItem?.itemName || 'Unnamed Product',
      itemImage: firstItem?.image || '',
      deliveryFee: Number(order.deliveryFee || 0),
      paidAt: order.paidAt,
      delivery: normalizedDelivery
    };
  });

  return res.status(200).json({
    success: true,
    message: 'Delivery data fetched successfully',
    data: mappedOrders
  });
});

exports.getCouriers = asyncHandler(async (req, res) => {
  const couriers = await Courier.find({ status: 'active' })
    .sort({ name: 1 })
    .select('_id name code type')
    .lean();

  return res.status(200).json({
    success: true,
    message: 'Courier list fetched successfully',
    data: couriers
  });
});

exports.updateDeliverySchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    recipientName = '',
    destinationAddress = '',
    courierPartner = '',
    pickupDateTime = '',
    packageWeight = '',
    courierPrice = 0,
    storeProfit = 0,
    totalPrice = 0,
    trackingNumber = '',
    notes = ''
  } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(422).json({
      success: false,
      message: 'Invalid order id'
    });
  }

  const order = await PosOrder.findById(id);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Delivery order not found'
    });
  }

  const trimmedRecipientName = String(recipientName).trim();
  const trimmedDestinationAddress = String(destinationAddress).trim();
  const trimmedCourierPartner = String(courierPartner).trim();
  const trimmedPackageWeight = String(packageWeight).trim();
  const trimmedTrackingNumber = String(trackingNumber).trim();
  const trimmedNotes = String(notes).trim();

  if (!trimmedRecipientName) {
    return res.status(422).json({
      success: false,
      message: 'Recipient name is required'
    });
  }

  if (!trimmedDestinationAddress) {
    return res.status(422).json({
      success: false,
      message: 'Destination address is required'
    });
  }

  if (!trimmedCourierPartner) {
    return res.status(422).json({
      success: false,
      message: 'Courier partner is required'
    });
  }

  if (!pickupDateTime) {
    return res.status(422).json({
      success: false,
      message: 'Pickup date and time is required'
    });
  }

  const parsedPickupDateTime = new Date(pickupDateTime);
  if (Number.isNaN(parsedPickupDateTime.getTime())) {
    return res.status(422).json({
      success: false,
      message: 'Invalid pickup date and time'
    });
  }

  if (!trimmedPackageWeight) {
    return res.status(422).json({
      success: false,
      message: 'Package weight is required'
    });
  }

  const numericCourierPrice = Number(courierPrice || 0);
  const numericStoreProfit = Number(storeProfit || 0);
  const numericTotalPrice = Number(totalPrice || 0);

  if (Number.isNaN(numericCourierPrice) || numericCourierPrice < 0) {
    return res.status(422).json({
      success: false,
      message: 'Invalid courier price'
    });
  }

  if (Number.isNaN(numericStoreProfit) || numericStoreProfit < 0) {
    return res.status(422).json({
      success: false,
      message: 'Invalid store profit'
    });
  }

  if (Number.isNaN(numericTotalPrice) || numericTotalPrice < 0) {
    return res.status(422).json({
      success: false,
      message: 'Invalid total price'
    });
  }

  const expectedStoreProfit = numericCourierPrice * (STORE_PROFIT_PERCENT / 100);
  const expectedTotalPrice = numericCourierPrice + expectedStoreProfit;

  if (Math.abs(numericStoreProfit - expectedStoreProfit) > 1) {
    return res.status(422).json({
      success: false,
      message: 'Invalid store profit calculation'
    });
  }

  if (Math.abs(numericTotalPrice - expectedTotalPrice) > 1) {
    return res.status(422).json({
      success: false,
      message: 'Invalid total price calculation'
    });
  }

  let courier = await Courier.findOne({
    name: { $regex: `^${trimmedCourierPartner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
  });

  if (!courier) {
    courier = await Courier.create({
      name: trimmedCourierPartner,
      code: '',
      type: 'other',
      status: 'active',
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null
    });
  } else {
    if (courier.status !== 'active') {
      courier.status = 'active';
    }
    courier.updatedBy = req.user?._id || null;
    await courier.save();
  }

  const firstItem = Array.isArray(order.items) && order.items.length > 0
    ? order.items[0]
    : null;

  order.deliveryFee = numericTotalPrice;
  order.delivery = {
    packageName: order.delivery?.packageName || firstItem?.itemName || '',
    recipientName: trimmedRecipientName,
    destinationAddress: trimmedDestinationAddress,
    courierId: courier._id,
    courierName: courier.name,
    pickupDateTime: parsedPickupDateTime,
    packageWeight: trimmedPackageWeight,
    courierPrice: numericCourierPrice,
    storeProfit: numericStoreProfit,
    totalPrice: numericTotalPrice,
    trackingNumber: trimmedTrackingNumber,
    notes: trimmedNotes,
    status: 'scheduled'
  };

  await order.save();

  return res.status(200).json({
    success: true,
    message: 'Delivery schedule updated successfully',
    data: {
      _id: order._id,
      receiptNumber: order.receiptNumber,
      deliveryFee: order.deliveryFee,
      delivery: {
        ...order.delivery.toObject(),
        courierPartner: order.delivery.courierName
      }
    }
  });
});
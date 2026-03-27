const mongoose = require('mongoose');
const MasterProduct = require('../models/MasterProduct');
const ProductItem = require('../models/ProductItem');
const Artisan = require('../models/Artisan');
const { generateChildCode } = require('../utils/generateCode');

const slugify = (text = '') => {
    return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const normalizeMasterProductImages = (images = []) => {
  if (!Array.isArray(images)) {
    return { images: [], coverImage: '' };
  }

  const cleanedImages = images
    .filter((img) => img && img.imageUrl)
    .map((img, index) => ({
      imageUrl: String(img.imageUrl).trim(),
      isCover: Boolean(img.isCover),
      sortOrder: Number(img.sortOrder ?? index + 1)
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // pastikan hanya 1 cover
  let foundCover = false;
  for (const img of cleanedImages) {
    if (img.isCover && !foundCover) {
      foundCover = true;
    } else {
      img.isCover = false;
    }
  }

  // kalau belum ada cover, pakai gambar pertama
  if (cleanedImages.length > 0 && !foundCover) {
    cleanedImages[0].isCover = true;
  }

  const cover = cleanedImages.find((img) => img.isCover);

  return {
    images: cleanedImages,
    coverImage: cover ? cover.imageUrl : ''
  };
};

const generateUniqueSlug = async (categoryName, productName) => {
  const baseSlug = slugify(`${categoryName}-${productName}`);
  let slug = baseSlug;
  let counter = 1;

  while (await MasterProduct.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

exports.getChildItems = async (req, res) => {
  try {
    const { id } = req.params;
    const { search = '', status = '' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid child product id'
      });
    }

    const productItem = await ProductItem.findById(id);

    if (!productItem) {
      return res.status(404).json({
        success: false,
        message: 'Child item not found'
      });
    }

    const filter = { _id: productItem._id };

    if (status && ['available', 'reserved', 'sold'].includes(status)) {
      filter.status = status;
    }

    if (search.trim()) {
      filter.$or = [
        { itemName: { $regex: search.trim(), $options: 'i' } },
        { childCode: { $regex: search.trim(), $options: 'i' } },
        { barcode: { $regex: search.trim(), $options: 'i' } },
        { woodType: { $regex: search.trim(), $options: 'i' } },
        { dimension: { $regex: search.trim(), $options: 'i' } },
        { notes: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const childItems = await ProductItem.find(filter)
      .populate('masterProductId', 'productName parentCode categoryName')
      .populate('artisanId', 'fullName phoneNumber commissionRate status')
      .populate('createdBy', 'username email role')
      .sort({ createdAt: -1 });

    const mappedChildItems = childItems.map((item) => ({
      _id: item._id,
      masterProductId: item.masterProductId?._id || null,
      masterProduct: item.masterProductId
        ? {
            _id: item.masterProductId._id,
            productName: item.masterProductId.productName,
            parentCode: item.masterProductId.parentCode,
            categoryName: item.masterProductId.categoryName
          }
        : null,
      itemName: item.itemName,
      childCode: item.childCode,
      barcode: item.barcode,
      productPhoto: item.productPhoto || '',
      woodType: item.woodType,
      dimension: item.dimension,
      artisan: item.artisanId
        ? {
            _id: item.artisanId._id,
            fullName: item.artisanId.fullName,
            phoneNumber: item.artisanId.phoneNumber,
            commissionRate: item.artisanId.commissionRate,
            status: item.artisanId.status
          }
        : null,
      costPrice: item.costPrice,
      sellingPrice: item.sellingPrice,
      status: item.status,
      reservedAt: item.reservedAt,
      soldAt: item.soldAt,
      notes: item.notes,
      createdBy: item.createdBy,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    }));

    return res.status(200).json({
      success: true,
      message: 'Child items fetched successfully',
      data: {
        total: mappedChildItems.length,
        items: mappedChildItems
      }
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

exports.updateChildItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      itemName,
      productPhoto,
      woodType,
      dimension,
      artisanId,
      costPrice,
      sellingPrice,
      status,
      notes
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid child product id'
      });
    }

    const childItem = await ProductItem.findById(id);

    if (!childItem) {
      return res.status(404).json({
        success: false,
        message: 'Child product not found'
      });
    }

    const masterProduct = await MasterProduct.findById(childItem.masterProductId);

    if (!masterProduct) {
      return res.status(404).json({
        success: false,
        message: 'Master product not found'
      });
    }

    if (artisanId !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(artisanId)) {
        return res.status(422).json({
          success: false,
          message: 'Invalid artisanId'
        });
      }

      const artisan = await Artisan.findById(artisanId);

      if (!artisan) {
        return res.status(404).json({
          success: false,
          message: 'Artisan not found'
        });
      }

      if (artisan.status !== 'active') {
        return res.status(422).json({
          success: false,
          message: 'Selected artisan is not active'
        });
      }

      childItem.artisanId = artisan._id;
    }

    if (costPrice !== undefined) {
      const numericCostPrice = Number(costPrice);

      if (Number.isNaN(numericCostPrice) || numericCostPrice < 0) {
        return res.status(422).json({
          success: false,
          message: 'costPrice must be a valid number greater than or equal to 0'
        });
      }

      childItem.costPrice = numericCostPrice;
    }

    if (sellingPrice !== undefined) {
      const numericSellingPrice = Number(sellingPrice);

      if (Number.isNaN(numericSellingPrice) || numericSellingPrice < 0) {
        return res.status(422).json({
          success: false,
          message: 'sellingPrice must be a valid number greater than or equal to 0'
        });
      }

      childItem.sellingPrice = numericSellingPrice;
    }

    if (status !== undefined) {
      if (!['available', 'reserved', 'sold'].includes(status)) {
        return res.status(422).json({
          success: false,
          message: 'Invalid status value'
        });
      }

      childItem.status = status;

      if (status === 'available') {
        childItem.reservedAt = null;
        childItem.soldAt = null;
      }

      if (status === 'reserved') {
        childItem.reservedAt = new Date();
        childItem.soldAt = null;
      }

      if (status === 'sold') {
        childItem.soldAt = new Date();
        childItem.reservedAt = null;
      }
    }

    if (itemName !== undefined) {
      childItem.itemName = itemName ? itemName.trim() : '';
    }

    if (productPhoto !== undefined) {
      childItem.productPhoto = productPhoto ? productPhoto.trim() : '';
    }

    if (woodType !== undefined) {
      childItem.woodType = woodType ? woodType.trim() : '';
    }

    if (dimension !== undefined) {
      childItem.dimension = dimension ? dimension.trim() : '';
    }

    if (notes !== undefined) {
      childItem.notes = notes ? notes.trim() : '';
    }

    await childItem.save();

    const updatedChildItem = await ProductItem.findById(childItem._id)
      .populate('masterProductId', 'parentCode categoryName productName status woodTypes coverImage')
      .populate('artisanId', 'fullName phoneNumber commissionRate status')
      .populate('createdBy', 'username email role');

    return res.status(200).json({
      success: true,
      message: 'Child product updated successfully',
      data: {
        _id: updatedChildItem._id,
        masterProductId: updatedChildItem.masterProductId?._id || null,
        masterProduct: updatedChildItem.masterProductId
          ? {
              _id: updatedChildItem.masterProductId._id,
              parentCode: updatedChildItem.masterProductId.parentCode,
              categoryName: updatedChildItem.masterProductId.categoryName,
              productName: updatedChildItem.masterProductId.productName,
              status: updatedChildItem.masterProductId.status,
              woodTypes: updatedChildItem.masterProductId.woodTypes || [],
              coverImage: updatedChildItem.masterProductId.coverImage || ''
            }
          : null,
        itemName: updatedChildItem.itemName || '',
        childCode: updatedChildItem.childCode,
        barcode: updatedChildItem.barcode,
        productPhoto: updatedChildItem.productPhoto || '',
        woodType: updatedChildItem.woodType || '',
        dimension: updatedChildItem.dimension || '',
        artisan: updatedChildItem.artisanId
          ? {
              _id: updatedChildItem.artisanId._id,
              fullName: updatedChildItem.artisanId.fullName,
              phoneNumber: updatedChildItem.artisanId.phoneNumber,
              commissionRate: updatedChildItem.artisanId.commissionRate,
              status: updatedChildItem.artisanId.status
            }
          : null,
        costPrice: updatedChildItem.costPrice,
        sellingPrice: updatedChildItem.sellingPrice,
        status: updatedChildItem.status,
        reservedAt: updatedChildItem.reservedAt,
        soldAt: updatedChildItem.soldAt,
        notes: updatedChildItem.notes || '',
        createdBy: updatedChildItem.createdBy || null,
        createdAt: updatedChildItem.createdAt,
        updatedAt: updatedChildItem.updatedAt
      }
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

exports.deleteChildItem = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid child product id'
      });
    }

    const childItem = await ProductItem.findById(id);

    if (!childItem) {
      return res.status(404).json({
        success: false,
        message: 'Child product not found'
      });
    }

    const masterProduct = await MasterProduct.findById(childItem.masterProductId);

    if (!masterProduct) {
      return res.status(404).json({
        success: false,
        message: 'Master product not found'
      });
    }

    // Optional guard:
    // kalau item sold tidak boleh dihapus, aktifkan blok ini
    // if (childItem.status === 'sold') {
    //   return res.status(409).json({
    //     success: false,
    //     message: 'Sold item cannot be deleted'
    //   });
    // }

    await ProductItem.findByIdAndDelete(childItem._id);

    return res.status(200).json({
      success: true,
      message: 'Child product deleted successfully',
      data: {
        _id: childItem._id,
        masterProductId: childItem.masterProductId,
        childCode: childItem.childCode
      }
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
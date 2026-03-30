const mongoose = require('mongoose');
const MasterProduct = require('../models/MasterProduct');
const ProductItem = require('../models/ProductItem');
const Artisan = require('../models/Artisan');
const Category = require('../models/Category');
const { generateChildCode, generateParentCode } = require('../utils/generateCode');
const slugify = require('../utils/slugify');

const generateUniqueSlug = async (categoryName, productName, excludeId = null) => {
  const baseSlug = slugify(`${categoryName}-${productName}`);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await MasterProduct.findOne({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {})
    });

    if (!existing) break;

    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
};

exports.getParentProducts = async (req, res) => {
  try {
    const parentProducts = await MasterProduct.find().sort({ createdAt: -1 });

    const parentProductsWithCounts = await Promise.all(
      parentProducts.map(async (parent) => {
        const totalChildItems = await ProductItem.countDocuments({
          masterProductId: parent._id
        });

        const availableStock = await ProductItem.countDocuments({
          masterProductId: parent._id,
          status: 'available'
        });

        return {
          ...parent.toObject(),
          totalChildItems,
          availableStock
        };
      })
    );

    return res.status(200).json({
      success: true,
      count: parentProductsWithCounts.length,
      data: parentProductsWithCounts
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

exports.createParentProduct = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const {
      categoryName,
      productName,
      description,
      woodTypes = [],
      logo = ''
    } = req.body;

    if (!categoryName || !String(categoryName).trim()) {
      return res.status(422).json({
        success: false,
        message: 'categoryName is required'
      });
    }

    if (!productName || !String(productName).trim()) {
      return res.status(422).json({
        success: false,
        message: 'productName is required'
      });
    }

    const trimmedCategoryName = String(categoryName).trim();
    const trimmedProductName = String(productName).trim();
    const trimmedDescription = description ? String(description).trim() : '';
    const trimmedLogo = logo ? String(logo).trim() : '';

    const normalizedWoodTypes = Array.isArray(woodTypes)
      ? [...new Set(woodTypes.map((item) => String(item).trim()).filter(Boolean))]
      : [];

    await session.withTransaction(async () => {
      const existingMaster = await MasterProduct.findOne({
        categoryName: trimmedCategoryName,
        productName: trimmedProductName
      }).session(session);

      if (existingMaster) {
        const error = new Error('Master product already exists. Please use Add New Child Item instead.');
        error.statusCode = 409;
        error.payload = {
          masterProductId: existingMaster._id,
          categoryName: existingMaster.categoryName,
          productName: existingMaster.productName
        };
        throw error;
      }

      let category = await Category.findOne({
        categoryName: trimmedCategoryName
      }).session(session);

      if (!category) {
        category = await Category.create(
          [
            {
              categoryName: trimmedCategoryName,
              status: 'active',
              createdBy: req.user?._id || null
            }
          ],
          { session }
        );

        category = category[0];
      }

      const slug = await generateUniqueSlug(trimmedCategoryName, trimmedProductName);
      const parentCode = await generateParentCode();

      const createdMasterProduct = await MasterProduct.create(
        [
          {
            parentCode,
            categoryName: trimmedCategoryName,
            productName: trimmedProductName,
            slug,
            description: trimmedDescription,
            woodTypes: normalizedWoodTypes,
            logo: trimmedLogo,
            status: 'active',
            createdBy: req.user?._id || null
          }
        ],
        { session }
      );

      res.status(201).json({
        success: true,
        message: 'Parent product created successfully',
        data: {
          ...createdMasterProduct[0].toObject(),
          category: {
            _id: category._id,
            categoryName: category.categoryName,
            status: category.status
          }
        }
      });
    });
  } catch (error) {
    console.error(error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: error.payload || null
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  } finally {
    await session.endSession();
  }
};

exports.getParentProductDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const { search = '' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid master product id'
      });
    }

    const masterProduct = await MasterProduct.findById(id)
      .populate('createdBy', 'username email role');

    if (!masterProduct) {
      return res.status(404).json({
        success: false,
        message: 'Master product not found'
      });
    }

    const childFilter = {
      masterProductId: masterProduct._id
    };

    if (search.trim()) {
      childFilter.$or = [
        { childCode: { $regex: search.trim(), $options: 'i' } },
        { barcode: { $regex: search.trim(), $options: 'i' } },
        { status: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const [childItems, totalChildItems, availableStock] = await Promise.all([
      ProductItem.find(childFilter)
        .populate('artisanId', 'fullName phoneNumber status')
        .sort({ createdAt: -1 }),
      ProductItem.countDocuments({ masterProductId: masterProduct._id }),
      ProductItem.countDocuments({
        masterProductId: masterProduct._id,
        status: 'available'
      })
    ]);

    const mappedChildItems = childItems.map((item) => ({
      _id: item._id,
      productName: item.itemName,
      childCode: item.childCode,
      barcode: item.barcode,
      productPhoto: item.productPhoto || '',
      woodType: item.woodType || '',
      dimension: item.dimension || '',
      status: item.status,
      artisan: item.artisanId
        ? {
            _id: item.artisanId._id,
            fullName: item.artisanId.fullName,
            phoneNumber: item.artisanId.phoneNumber,
            status: item.artisanId.status
          }
        : null,
      createdAt: item.createdAt,
      soldAt: item.soldAt || null
    }));

    return res.status(200).json({
      success: true,
      message: 'Master product detail fetched successfully',
      data: {
        _id: masterProduct._id,
        parentCode: masterProduct.parentCode,
        categoryName: masterProduct.categoryName,
        productName: masterProduct.productName,
        slug: masterProduct.slug,
        description: masterProduct.description || '',
        woodTypes: masterProduct.woodTypes || [],
        logo: masterProduct.logo || '',
        status: masterProduct.status,
        createdBy: masterProduct.createdBy || null,
        createdAt: masterProduct.createdAt,
        updatedAt: masterProduct.updatedAt,
        totalChildItems,
        availableStock,
        childItems: mappedChildItems
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

exports.updateParentProduct = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const {
      categoryName,
      productName,
      description,
      woodTypes,
      logo,
      status
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid master product id'
      });
    }

    await session.withTransaction(async () => {
      const masterProduct = await MasterProduct.findById(id).session(session);

      if (!masterProduct) {
        const error = new Error('Master product not found');
        error.statusCode = 404;
        throw error;
      }

      const nextCategoryName =
        categoryName !== undefined
          ? String(categoryName).trim()
          : masterProduct.categoryName;

      const nextProductName =
        productName !== undefined
          ? String(productName).trim()
          : masterProduct.productName;

      if (!nextCategoryName) {
        const error = new Error('categoryName is required');
        error.statusCode = 422;
        throw error;
      }

      if (!nextProductName) {
        const error = new Error('productName is required');
        error.statusCode = 422;
        throw error;
      }

      const duplicateMaster = await MasterProduct.findOne({
        _id: { $ne: masterProduct._id },
        categoryName: nextCategoryName,
        productName: nextProductName
      }).session(session);

      if (duplicateMaster) {
        const error = new Error(
          'Master product already exists. Please use a different category or product name.'
        );
        error.statusCode = 409;
        error.payload = {
          masterProductId: duplicateMaster._id,
          categoryName: duplicateMaster.categoryName,
          productName: duplicateMaster.productName
        };
        throw error;
      }

      let category = await Category.findOne({
        categoryName: nextCategoryName
      }).session(session);

      if (!category) {
        const createdCategories = await Category.create(
          [
            {
              categoryName: nextCategoryName,
              status: 'active',
              createdBy: req.user?._id || null
            }
          ],
          { session }
        );

        category = createdCategories[0];
      }

      let needRegenerateSlug = false;

      if (nextCategoryName !== masterProduct.categoryName) {
        masterProduct.categoryName = nextCategoryName;
        needRegenerateSlug = true;
      }

      if (nextProductName !== masterProduct.productName) {
        masterProduct.productName = nextProductName;
        needRegenerateSlug = true;
      }

      if (description !== undefined) {
        masterProduct.description = String(description).trim();
      }

      if (Array.isArray(woodTypes)) {
        masterProduct.woodTypes = [
          ...new Set(woodTypes.map((item) => String(item).trim()).filter(Boolean))
        ];
      }

      if (logo !== undefined) {
        masterProduct.logo = logo ? String(logo).trim() : '';
      }

      if (status !== undefined) {
        masterProduct.status = status;
      }

      if (needRegenerateSlug) {
        masterProduct.slug = await generateUniqueSlug(
          masterProduct.categoryName,
          masterProduct.productName,
          masterProduct._id
        );
      }

      await masterProduct.save({ session });

      res.status(200).json({
        success: true,
        message: 'Parent product updated successfully',
        data: {
          ...masterProduct.toObject(),
          category: {
            _id: category._id,
            categoryName: category.categoryName,
            status: category.status
          }
        }
      });
    });
  } catch (error) {
    console.error(error);

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        data: error.payload || null
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate data detected',
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  } finally {
    await session.endSession();
  }
};

exports.deleteParentProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid master product id'
      });
    }

    const masterProduct = await MasterProduct.findById(id);

    if (!masterProduct) {
      return res.status(404).json({
        success: false,
        message: 'Master product not found'
      });
    }

    const childCount = await ProductItem.countDocuments({
      masterProductId: masterProduct._id
    });

    if (childCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete parent product because it still has child products'
      });
    }

    await MasterProduct.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Parent product deleted successfully'
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

exports.addChildItemToMasterProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      itemName,
      serialCode,
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
        message: 'Invalid master product id'
      });
    }

    if (!artisanId || !mongoose.Types.ObjectId.isValid(artisanId)) {
      return res.status(422).json({
        success: false,
        message: 'Valid artisanId is required'
      });
    }

    if (costPrice === undefined || costPrice === null || costPrice === '') {
      return res.status(422).json({
        success: false,
        message: 'costPrice is required'
      });
    }

    if (sellingPrice === undefined || sellingPrice === null || sellingPrice === '') {
      return res.status(422).json({
        success: false,
        message: 'sellingPrice is required'
      });
    }

    const numericCostPrice = Number(costPrice);
    const numericSellingPrice = Number(sellingPrice);

    if (Number.isNaN(numericCostPrice) || numericCostPrice < 0) {
      return res.status(422).json({
        success: false,
        message: 'costPrice must be a valid number greater than or equal to 0'
      });
    }

    if (Number.isNaN(numericSellingPrice) || numericSellingPrice < 0) {
      return res.status(422).json({
        success: false,
        message: 'sellingPrice must be a valid number greater than or equal to 0'
      });
    }

    if (status && !['available', 'reserved', 'sold'].includes(status)) {
      return res.status(422).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const [masterProduct, artisan] = await Promise.all([
      MasterProduct.findById(id),
      Artisan.findById(artisanId)
    ]);

    if (!masterProduct) {
      return res.status(404).json({
        success: false,
        message: 'Master product not found'
      });
    }

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

    const childCode =
      serialCode && String(serialCode).trim()
        ? String(serialCode).trim()
        : await generateChildCode();

    const now = new Date();
    const finalStatus = status || 'available';

    let reservedAt = null;
    let soldAt = null;

    if (finalStatus === 'reserved') reservedAt = now;
    if (finalStatus === 'sold') soldAt = now;

    const productItem = await ProductItem.create({
      masterProductId: masterProduct._id,
      itemName: itemName ? itemName.trim() : '',
      childCode,
      barcode: childCode,
      productPhoto: productPhoto ? productPhoto.trim() : '',
      woodType: woodType ? woodType.trim() : '',
      dimension: dimension ? dimension.trim() : '',
      artisanId: artisan._id,
      costPrice: numericCostPrice,
      sellingPrice: numericSellingPrice,
      status: finalStatus,
      reservedAt,
      soldAt,
      notes: notes ? notes.trim() : '',
      createdBy: req.user?._id || null
    });

    const populatedItem = await ProductItem.findById(productItem._id)
      .populate('masterProductId', 'parentCode categoryName productName logo status')
      .populate('artisanId', 'fullName phoneNumber commissionRate status')
      .populate('createdBy', 'username email role');

    return res.status(201).json({
      success: true,
      message: 'Child product added successfully',
      data: populatedItem
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
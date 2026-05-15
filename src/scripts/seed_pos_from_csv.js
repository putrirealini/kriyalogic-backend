const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Artisan = require('../models/Artisan');
const ArtisanCommission = require('../models/ArtisanCommission');
const Guide = require('../models/Guide');
const MasterProduct = require('../models/MasterProduct');
const PosOrder = require('../models/PosOrder');
const ProductItem = require('../models/ProductItem');
require('dotenv').config();

const CSV_PATH = path.resolve(__dirname, '../../KriyaLogic_Final_English.csv');

const cleanMoney = (value) => {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/Rp/g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const cleanNumber = (value) => {
  if (value === null || value === undefined) return 0;

  const cleaned = String(value)
    .replace(/,/g, '')
    .replace(/\s/g, '')
    .trim();

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const slugify = (value, fallback) => {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
};

const parseCsvDate = (value) => {
  const [month, day, year] = String(value || '').split('/').map(Number);

  if (!month || !day || !year) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
};

const normalizePaymentMethod = (value) => {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'qris') return 'qris';
  if (normalized === 'cash') return 'cash';

  return 'card';
};

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
};

const getRows = () => {
  const csvText = fs.readFileSync(CSV_PATH, 'utf8').replace(/^\uFEFF/, '');
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  const headers = parseCsvLine(lines.shift()).map((header) => header.trim());

  return lines.map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] === undefined ? '' : values[index];
    });

    return row;
  });
};

const getOrCreateArtisan = async (name, commissionRate) => {
  const fullName = String(name || '').trim() || 'Unknown Artisan';
  const existing = await Artisan.findOne({ fullName });

  if (existing) {
    existing.commissionRate = commissionRate;
    existing.status = 'active';
    await existing.save();
    return existing;
  }

  return Artisan.create({
    fullName,
    phoneNumber: `DUMMY-ART-${slugify(fullName, 'artisan').slice(0, 40)}`,
    commissionRate,
    bankAccount: `DUMMY-${slugify(fullName, 'artisan').slice(0, 30)}`,
    address: 'Dummy CSV address',
    status: 'active'
  });
};

const getOrCreateGuide = async (name, commissionRate) => {
  const guideName = String(name || '').trim() || 'No Guide';
  const existing = await Guide.findOne({ guideName });

  if (existing) {
    existing.commissionRate = commissionRate;
    existing.status = 'active';
    await existing.save();
    return existing;
  }

  return Guide.create({
    guideName,
    agency: 'CSV Dummy Agency',
    commissionRate,
    contact: `DUMMY-GDE-${slugify(guideName, 'guide').slice(0, 40)}`,
    status: 'active'
  });
};

const getOrCreateMasterProduct = async ({ parentCode, productName }) => {
  const existing = await MasterProduct.findOne({ parentCode });

  if (existing) {
    existing.productName = productName;
    existing.status = 'active';
    await existing.save();
    return existing;
  }

  return MasterProduct.create({
    parentCode,
    categoryName: 'Dummy CSV Product',
    productName,
    slug: `${slugify(productName, parentCode)}-${parentCode.toLowerCase()}`,
    description: 'Generated from KriyaLogic_Final_English.csv',
    woodTypes: [],
    logo: '',
    status: 'active'
  });
};

const upsertProductItem = async ({
  masterProduct,
  artisan,
  childCode,
  childProduct,
  costPrice,
  sellingPrice,
  paidAt
}) =>
  ProductItem.findOneAndUpdate(
    { childCode },
    {
      $set: {
        masterProductId: masterProduct._id,
        itemName: childProduct,
        childCode,
        barcode: childCode,
        productPhoto: '',
        woodType: '',
        dimension: '',
        artisanId: artisan._id,
        costPrice,
        sellingPrice,
        status: 'sold',
        soldAt: paidAt,
        reservedAt: null,
        notes: 'Generated from KriyaLogic_Final_English.csv'
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

const upsertAvailableStockItems = async ({
  masterProduct,
  artisan,
  productName,
  costPrice,
  sellingPrice,
  count = 5
}) => {
  for (let index = 1; index <= count; index += 1) {
    const sequence = String(index).padStart(3, '0');
    const childCode = `${masterProduct.parentCode}-STOCK-${sequence}`;

    await ProductItem.findOneAndUpdate(
      { childCode },
      {
        $set: {
          masterProductId: masterProduct._id,
          itemName: `${productName} Stock ${sequence}`,
          childCode,
          barcode: childCode,
          productPhoto: '',
          woodType: '',
          dimension: '',
          artisanId: artisan._id,
          costPrice,
          sellingPrice,
          status: 'available',
          soldAt: null,
          reservedAt: null,
          notes: 'Available dummy stock generated for forecast actual stock'
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
  }
};

const upsertOrder = async ({
  row,
  masterProduct,
  artisan,
  guide,
  productItem,
  paidAt
}) => {
  const childCode = String(row['Child Code'] || '').trim();
  const quantity = cleanNumber(row.Jumlah) || 1;
  const sellingPrice = cleanMoney(row['Selling Price per Unit (Rp)']);
  const totalSales = cleanMoney(row['Total Sales (Rp)']) || sellingPrice * quantity;
  const costPrice = cleanMoney(row['Cost Price per Unit (Rp)']);
  const artisanCommissionRate = cleanNumber(row['Artisan Commission (%)']);
  const artisanCommissionAmount = cleanMoney(row['Artisan Commission (Rp)']);
  const guideCommissionRate = cleanNumber(row['Guide Commission (%)']);
  const guideCommissionAmount = cleanMoney(row['Guide Commission (Rp)']);
  const courierPrice = Math.round(totalSales * 0.05);
  const deliveryProfit = Math.round(courierPrice * 0.15);
  const deliveryTotal = courierPrice + deliveryProfit;
  const dateKey = paidAt.toISOString().slice(0, 10).replace(/-/g, '');
  const receiptNumber = `CSV-${dateKey}-${childCode}`;

  const item = {
    productItemId: productItem._id,
    masterProductId: masterProduct._id,
    artisanId: artisan._id,
    artisanName: artisan.fullName,
    artisanCommissionRate,
    artisanCommissionAmount,
    costPrice,
    itemName: String(row['Child Product'] || row['Nama Patung'] || '').trim(),
    childCode,
    image: '',
    qty: quantity,
    price: sellingPrice,
    subtotal: totalSales
  };

  const order = await PosOrder.findOneAndUpdate(
    { receiptNumber },
    {
      $set: {
        receiptNumber,
        customerName: 'CSV Dummy Customer',
        customerPhone: '',
        cashierId: null,
        cashierName: 'CSV Seeder',
        guideId: guide._id,
        guideName: guide.guideName,
        guideCommissionRate,
        guideCommissionAmount,
        items: [item],
        subtotal: totalSales,
        taxPercent: 0,
        taxAmount: 0,
        deliveryFee: deliveryTotal,
        delivery: {
          packageName: `Delivery ${childCode}`,
          recipientName: 'CSV Dummy Customer',
          destinationAddress: 'Dummy delivery address',
          courierId: null,
          courierName: 'CSV Dummy Courier',
          pickupDateTime: paidAt,
          packageWeight: '1 kg',
          courierPrice,
          storeProfit: deliveryProfit,
          totalPrice: deliveryTotal,
          trackingNumber: `CSV-TRK-${childCode}`,
          notes: 'Dummy delivery generated from sales CSV',
          status: 'scheduled'
        },
        discount: 0,
        totalAmount: totalSales + guideCommissionAmount + deliveryTotal,
        paymentMethod: normalizePaymentMethod(row['Metode Pembayaran']),
        amountPaid: totalSales + guideCommissionAmount + deliveryTotal,
        changeAmount: 0,
        status: 'paid',
        paidAt
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );

  await ArtisanCommission.deleteMany({ orderId: order._id });
  await ArtisanCommission.create({
    artisanId: artisan._id,
    productItemId: productItem._id,
    orderId: order._id,
    itemName: item.itemName,
    childCode,
    sellingPrice,
    commissionRate: artisanCommissionRate,
    commissionAmount: artisanCommissionAmount,
    status: 'unpaid',
    paidAt: null,
    paidBy: null,
    createdAt: paidAt
  });
};

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kriyalogic');

  const rows = await getRows();
  let seeded = 0;
  let stockSeeded = 0;
  let skipped = 0;
  const stockedParentCodes = new Set();

  for (const row of rows) {
    const paidAt = parseCsvDate(row.Tanggal);
    const parentCode = String(row['Parent Code'] || '').trim();
    const childCode = String(row['Child Code'] || '').trim();
    const productName = String(row['Nama Patung'] || '').trim();

    if (!paidAt || !parentCode || !childCode || !productName) {
      skipped += 1;
      continue;
    }

    const artisanCommissionRate = cleanNumber(row['Artisan Commission (%)']);
    const guideCommissionRate = cleanNumber(row['Guide Commission (%)']);
    const artisan = await getOrCreateArtisan(row['Nama Artisan'], artisanCommissionRate);
    const guide = await getOrCreateGuide(row['Tour Guide'], guideCommissionRate);
    const masterProduct = await getOrCreateMasterProduct({ parentCode, productName });
    const productItem = await upsertProductItem({
      masterProduct,
      artisan,
      childCode,
      childProduct: String(row['Child Product'] || productName).trim(),
      costPrice: cleanMoney(row['Cost Price per Unit (Rp)']),
      sellingPrice: cleanMoney(row['Selling Price per Unit (Rp)']),
      paidAt
    });

    if (!stockedParentCodes.has(parentCode)) {
      await upsertAvailableStockItems({
        masterProduct,
        artisan,
        productName,
        costPrice: cleanMoney(row['Cost Price per Unit (Rp)']),
        sellingPrice: cleanMoney(row['Selling Price per Unit (Rp)'])
      });

      stockedParentCodes.add(parentCode);
      stockSeeded += 5;
    }

    await upsertOrder({
      row,
      masterProduct,
      artisan,
      guide,
      productItem,
      paidAt
    });

    seeded += 1;
  }

  console.log(
    `Seeded/updated ${seeded} POS orders and ${stockSeeded} available stock items from CSV. Skipped ${skipped} rows.`
  );
  await mongoose.connection.close();
};

seed().catch(async (error) => {
  console.error('Failed to seed POS CSV data:', error);
  await mongoose.connection.close();
  process.exit(1);
});

const Counter = require('../models/Counter');

const getNextSequence = async (key) => {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  return counter.seq;
};

const generateParentCode = async () => {
  const seq = await getNextSequence('master_product_code');
  return `PRD-${String(seq).padStart(5, '0')}`;
};

const generateChildCode = async () => {
  const seq = await getNextSequence('product_item_code');
  return `ITEM-${String(seq).padStart(6, '0')}`;
};

module.exports = {
  getNextSequence,
  generateParentCode,
  generateChildCode,
};
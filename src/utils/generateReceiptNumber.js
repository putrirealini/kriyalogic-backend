const PosOrder = require('../models/PosOrder');

const padNumber = (num, length = 4) => String(num).padStart(length, '0');

const generateReceiptNumber = async (session = null) => {
  const now = new Date();

  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');

  const prefix = `RCPT-${yyyy}${mm}${dd}`;

  const start = new Date(yyyy, now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(yyyy, now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const query = PosOrder.find({
    createdAt: {
      $gte: start,
      $lte: end
    }
  }).sort({ createdAt: -1 });

  if (session) {
    query.session(session);
  }

  const lastOrder = await query.exec();

  let sequence = 1;

  if (lastOrder.length > 0) {
    const lastReceipt = lastOrder[0].receiptNumber || '';
    const parts = lastReceipt.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);

    if (!Number.isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}-${padNumber(sequence)}`;
};

module.exports = generateReceiptNumber;
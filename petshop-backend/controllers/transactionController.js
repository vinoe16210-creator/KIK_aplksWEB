const pool = require('../config/db');

function genTxId() {
  return 'TX' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// POST /api/transactions/checkout
// body: { items: [{ productId, qty }], metode }
async function checkout(req, res) {
  const { items, metode } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Keranjang kosong.' });
  }
  if (!['Tunai', 'QRIS', 'Debit'].includes(metode)) {
    return res.status(400).json({ message: 'Metode pembayaran tidak valid.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const txId = genTxId();
    const waktu = new Date();
    const receiptLines = [];
    let grandTotal = 0;

    for (const item of items) {
      const [rows] = await conn.query('SELECT * FROM products WHERE id = ? FOR UPDATE', [item.productId]);
      if (rows.length === 0) {
        throw { status: 404, message: `Produk dengan id ${item.productId} tidak ditemukan.` };
      }
      const product = rows[0];
      const qty = Number(item.qty) || 0;

      if (qty <= 0) {
        throw { status: 400, message: `Jumlah untuk "${product.nama}" tidak valid.` };
      }
      if (qty > product.stok) {
        throw { status: 400, message: `Stok "${product.nama}" tidak mencukupi.` };
      }

      const lineTotal = product.jual * qty;
      grandTotal += lineTotal;

      await conn.query('UPDATE products SET stok = stok - ? WHERE id = ?', [qty, product.id]);

      await conn.query(
        `INSERT INTO transactions (tx_id, product_id, nama, qty, harga, total, metode, waktu)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [txId, product.id, product.nama, qty, product.jual, lineTotal, metode, waktu]
      );

      receiptLines.push({ nama: product.nama, qty, harga: product.jual, total: lineTotal });
    }

    await conn.commit();

    res.status(201).json({
      txId,
      waktu,
      metode,
      total: grandTotal,
      items: receiptLines
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Gagal memproses transaksi.' });
  } finally {
    conn.release();
  }
}

// GET /api/transactions?limit=&today=true
async function getTransactions(req, res) {
  try {
    const { limit, today } = req.query;
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (today === 'true') {
      sql += ' AND DATE(waktu) = CURDATE()';
    }
    sql += ' ORDER BY waktu DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(Number(limit));
    }

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data transaksi.' });
  }
}

module.exports = { checkout, getTransactions };

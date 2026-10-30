const pool = require('../config/db');

function statusOf(stok) {
  if (stok <= 0) return 'Habis';
  if (stok <= 5) return 'Menipis';
  return 'Aman';
}

function withStatus(row) {
  return { ...row, status: statusOf(row.stok) };
}

// GET /api/products?search=&kategori=&status=
async function getProducts(req, res) {
  try {
    const { search, kategori, status } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search) {
      sql += ' AND (nama LIKE ? OR sku LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (kategori) {
      sql += ' AND kategori = ?';
      params.push(kategori);
    }
    sql += ' ORDER BY nama ASC';

    const [rows] = await pool.query(sql, params);
    let result = rows.map(withStatus);

    if (status) {
      result = result.filter((p) => p.status === status);
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data barang.' });
  }
}

// GET /api/products/:id
async function getProductById(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Barang tidak ditemukan.' });
    res.json(withStatus(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil data barang.' });
  }
}

// POST /api/products
async function createProduct(req, res) {
  try {
    const { nama, sku, kategori, modal, jual, stok } = req.body;
    if (!nama || !sku) {
      return res.status(400).json({ message: 'Nama dan SKU wajib diisi.' });
    }

    const [existing] = await pool.query('SELECT id FROM products WHERE sku = ?', [sku]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'SKU sudah digunakan oleh barang lain.' });
    }

    const [result] = await pool.query(
      'INSERT INTO products (nama, sku, kategori, modal, jual, stok) VALUES (?, ?, ?, ?, ?, ?)',
      [nama, sku, kategori || 'Makanan', Number(modal) || 0, Number(jual) || 0, Number(stok) || 0]
    );

    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(withStatus(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menambah barang.' });
  }
}

// PUT /api/products/:id
async function updateProduct(req, res) {
  try {
    const { id } = req.params;
    const { nama, sku, kategori, modal, jual, stok } = req.body;

    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Barang tidak ditemukan.' });

    if (sku) {
      const [dupe] = await pool.query('SELECT id FROM products WHERE sku = ? AND id != ?', [sku, id]);
      if (dupe.length > 0) {
        return res.status(409).json({ message: 'SKU sudah digunakan oleh barang lain.' });
      }
    }

    await pool.query(
      `UPDATE products
       SET nama = ?, sku = ?, kategori = ?, modal = ?, jual = ?, stok = ?
       WHERE id = ?`,
      [
        nama ?? rows[0].nama,
        sku ?? rows[0].sku,
        kategori ?? rows[0].kategori,
        modal !== undefined ? Number(modal) : rows[0].modal,
        jual !== undefined ? Number(jual) : rows[0].jual,
        stok !== undefined ? Number(stok) : rows[0].stok,
        id
      ]
    );

    const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    res.json(withStatus(updated[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal memperbarui barang.' });
  }
}

// PATCH /api/products/:id/restock  { jumlah }
async function restockProduct(req, res) {
  try {
    const { id } = req.params;
    const jumlah = Number(req.body.jumlah);

    if (!jumlah || jumlah <= 0) {
      return res.status(400).json({ message: 'Masukkan jumlah stok yang valid.' });
    }

    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Barang tidak ditemukan.' });

    await pool.query('UPDATE products SET stok = stok + ? WHERE id = ?', [jumlah, id]);
    const [updated] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    res.json(withStatus(updated[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menambah stok.' });
  }
}

// DELETE /api/products/:id
async function deleteProduct(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Barang tidak ditemukan.' });

    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    res.json({ message: 'Barang berhasil dihapus.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal menghapus barang.' });
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  restockProduct,
  deleteProduct
};

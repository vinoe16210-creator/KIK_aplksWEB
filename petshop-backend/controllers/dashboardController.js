const pool = require('../config/db');

// GET /api/dashboard/summary
async function getSummary(req, res) {
  try {
    const [[{ totalPenjualan }]] = await pool.query(
      `SELECT COALESCE(SUM(total),0) AS totalPenjualan
       FROM transactions WHERE DATE(waktu) = CURDATE()`
    );
    const [[{ jumlahTransaksi }]] = await pool.query(
      `SELECT COUNT(DISTINCT tx_id) AS jumlahTransaksi
       FROM transactions WHERE DATE(waktu) = CURDATE()`
    );
    const [[{ totalStok }]] = await pool.query(
      `SELECT COALESCE(SUM(stok),0) AS totalStok FROM products`
    );
    const [[{ stokMenipis }]] = await pool.query(
      `SELECT COUNT(*) AS stokMenipis FROM products WHERE stok <= 5`
    );

    // grafik 7 hari terakhir
    const [chartRows] = await pool.query(
      `SELECT DATE(waktu) AS tanggal, COALESCE(SUM(total),0) AS total
       FROM transactions
       WHERE waktu >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(waktu)
       ORDER BY tanggal ASC`
    );

    res.json({
      totalPenjualanHariIni: totalPenjualan,
      jumlahTransaksiHariIni: jumlahTransaksi,
      totalStok,
      stokMenipisAtauHabis: stokMenipis,
      grafik7Hari: chartRows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil ringkasan dashboard.' });
  }
}

module.exports = { getSummary };

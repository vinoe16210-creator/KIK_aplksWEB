require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

const products = [
  { nama: "Royal Canin Fit 32 1kg", sku: "RCFT32", kategori: "Makanan", modal: 180000, jual: 250000, stok: 50 },
  { nama: "Whiskas Pouch Chicken 85g", sku: "WSKCH85", kategori: "Makanan", modal: 20000, jual: 30000, stok: 40 },
  { nama: "Susu Kucing Bubuk", sku: "SUSK01", kategori: "Makanan", modal: 20000, jual: 34000, stok: 4 },
  { nama: "Pakan Anjing Premium 1kg", sku: "PAKJ01", kategori: "Makanan", modal: 50000, jual: 75000, stok: 5 },
  { nama: "Dog's Toy Bola Karet", sku: "DGTY01", kategori: "Mainan", modal: 15000, jual: 26000, stok: 12 },
  { nama: "Dog Squeak Toy", sku: "DSQTY1", kategori: "Mainan", modal: 15000, jual: 26000, stok: 0 },
  { nama: "Kalung Hewan Motif", sku: "KLGH01", kategori: "Aksesoris", modal: 10000, jual: 18000, stok: 30 },
  { nama: "Baju Hewan Lucu", sku: "BJHW01", kategori: "Aksesoris", modal: 40000, jual: 60000, stok: 10 },
  { nama: "Bentonite Cat Litter 5kg", sku: "BNTCL5", kategori: "Perawatan", modal: 45000, jual: 68000, stok: 22 },
  { nama: "Pasir Kucing Wangi", sku: "PSRK01", kategori: "Perawatan", modal: 15000, jual: 23000, stok: 3 },
  { nama: "Sampo Hewan", sku: "SMPH01", kategori: "Perawatan", modal: 30000, jual: 45000, stok: 18 },
  { nama: "Sikat Gigi Hewan", sku: "PETB1", kategori: "Perawatan", modal: 35000, jual: 50000, stok: 15 }
];

async function run() {
  try {
    console.log('Menambahkan produk awal...');
    for (const p of products) {
      await pool.query(
        `INSERT INTO products (nama, sku, kategori, modal, jual, stok)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE nama = nama`, // skip jika SKU sudah ada
        [p.nama, p.sku, p.kategori, p.modal, p.jual, p.stok]
      );
    }

    console.log('Membuat akun owner default (username: owner / password: owner123)...');
    const hashed = await bcrypt.hash('owner123', 10);
    await pool.query(
      `INSERT INTO users (username, password, role)
       VALUES ('owner', ?, 'owner')
       ON DUPLICATE KEY UPDATE username = username`,
      [hashed]
    );

    console.log('Seeding selesai. Segera ganti password default demi keamanan.');
    process.exit(0);
  } catch (err) {
    console.error('Gagal seeding:', err);
    process.exit(1);
  }
}

run();

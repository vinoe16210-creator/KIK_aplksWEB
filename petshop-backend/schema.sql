-- ============================================
-- Database: gnr_pethouse
-- Jalankan file ini di MySQL untuk membuat struktur tabel
-- ============================================

CREATE DATABASE IF NOT EXISTS gnr_pethouse
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE gnr_pethouse;

-- ---------- USERS (login) ----------
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,   -- hash bcrypt
  role VARCHAR(50) NOT NULL DEFAULT 'owner',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- PRODUCTS (Barang / Inventaris) ----------
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(150) NOT NULL,
  sku VARCHAR(50) NOT NULL UNIQUE,
  kategori ENUM('Makanan','Mainan','Aksesoris','Perawatan') NOT NULL DEFAULT 'Makanan',
  modal INT NOT NULL DEFAULT 0,
  jual INT NOT NULL DEFAULT 0,
  stok INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------- TRANSACTIONS (Kasir) ----------
-- Satu baris = satu baris item dalam satu transaksi (seperti struktur asli di localStorage)
CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tx_id VARCHAR(40) NOT NULL,          -- id gabungan (satu nomor struk bisa punya banyak baris)
  product_id INT NULL,
  nama VARCHAR(150) NOT NULL,          -- disimpan terpisah agar riwayat tetap utuh walau produk dihapus
  qty INT NOT NULL,
  harga INT NOT NULL,
  total INT NOT NULL,
  metode ENUM('Tunai','QRIS','Debit') NOT NULL,
  waktu DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_transactions_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE INDEX idx_transactions_waktu ON transactions(waktu);
CREATE INDEX idx_transactions_txid ON transactions(tx_id);
CREATE INDEX idx_products_kategori ON products(kategori);

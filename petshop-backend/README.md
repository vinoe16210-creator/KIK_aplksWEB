# GnR PetHouse — Backend (Node.js + Express + MySQL)

Backend ini menggantikan penyimpanan `localStorage` pada `script.js` dengan
database MySQL sungguhan, lewat REST API (Express + JWT untuk login).

## Struktur Folder
```
petshop-backend/
├── config/db.js              # koneksi pool MySQL
├── controllers/               # logika bisnis tiap fitur
├── middleware/auth.js         # verifikasi token JWT
├── routes/                    # daftar endpoint
├── schema.sql                 # struktur tabel database
├── seed.js                    # isi data awal (produk + akun owner)
├── server.js                  # entry point aplikasi
├── .env.example
└── package.json
```

## Langkah-langkah Instalasi

### 1. Prasyarat
- Node.js versi 18 ke atas — cek dengan `node -v`
- MySQL Server (lokal, XAMPP/Laragon, atau MySQL di cloud)

### 2. Install dependencies
```bash
cd petshop-backend
npm install
```

### 3. Buat database & tabel
Login ke MySQL lalu jalankan file `schema.sql`:
```bash
mysql -u root -p < schema.sql
```
Atau buka `schema.sql` di phpMyAdmin / MySQL Workbench lalu jalankan (Run) isinya.
Ini akan membuat database `gnr_pethouse` beserta tabel `users`, `products`, `transactions`.

### 4. Konfigurasi environment
Salin `.env.example` menjadi `.env`, lalu sesuaikan dengan kredensial MySQL-mu:
```bash
cp .env.example .env
```
```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=isi_password_mysql_kamu
DB_NAME=gnr_pethouse
JWT_SECRET=ganti_dengan_string_rahasia_yang_panjang
JWT_EXPIRES_IN=8h
```

### 5. Isi data awal (opsional tapi disarankan)
Mengisi 12 produk contoh + 1 akun login (`owner` / `owner123`), sama seperti data
dummy yang sebelumnya ada di `script.js`:
```bash
npm run seed
```

### 6. Jalankan server
```bash
npm start
```
atau selama development (auto-restart saat ada perubahan file):
```bash
npm run dev
```
Server akan berjalan di `http://localhost:3000`.

### 7. Tes cepat
```bash
curl http://localhost:3000
# -> {"message":"GnR PetHouse API aktif 🐾"}

curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"owner","password":"owner123"}'
```
Simpan `token` dari response untuk dipakai di endpoint lain (header `Authorization: Bearer <token>`).

---

## Dokumentasi API

### Auth
| Method | Endpoint | Body | Keterangan |
|---|---|---|---|
| POST | `/api/auth/register` | `{ username, password, role? }` | Buat akun baru (dipakai sekali untuk setup, bisa dimatikan setelah akun owner dibuat) |
| POST | `/api/auth/login` | `{ username, password }` | Login → balas `{ token, user }` |

Semua endpoint di bawah ini **wajib** header:
```
Authorization: Bearer <token>
```

### Produk / Barang
| Method | Endpoint | Body | Keterangan |
|---|---|---|---|
| GET | `/api/products?search=&kategori=&status=` | — | List barang, bisa difilter (status: Aman/Menipis/Habis) |
| GET | `/api/products/:id` | — | Detail satu barang |
| POST | `/api/products` | `{ nama, sku, kategori, modal, jual, stok }` | Tambah barang baru |
| PUT | `/api/products/:id` | `{ nama, sku, kategori, modal, jual, stok }` | Edit barang |
| PATCH | `/api/products/:id/restock` | `{ jumlah }` | Tambah stok |
| DELETE | `/api/products/:id` | — | Hapus barang |

### Transaksi / Kasir
| Method | Endpoint | Body | Keterangan |
|---|---|---|---|
| GET | `/api/transactions?today=true&limit=5` | — | List transaksi (untuk tabel "Transaksi Terbaru") |
| POST | `/api/transactions/checkout` | `{ items: [{ productId, qty }], metode }` | Proses checkout kasir — mengurangi stok & menyimpan transaksi dalam satu operasi atomik (rollback otomatis jika stok tidak cukup) |

`metode` harus salah satu dari: `Tunai`, `QRIS`, `Debit`.

### Dashboard (halaman Beranda)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/api/dashboard/summary` | Mengembalikan total penjualan hari ini, jumlah transaksi, total stok, jumlah stok menipis/habis, dan data grafik 7 hari terakhir |

---

## Menghubungkan ke Frontend yang Sudah Ada

`script.js` saat ini memakai `localStorage` untuk semua data. Untuk
menyambungkannya ke backend ini, ganti pemanggilan `state` langsung dengan
`fetch()` ke endpoint di atas, contoh untuk login:

```js
async function tryLogin(username, password) {
  const res = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message);
  }
  const data = await res.json();
  localStorage.setItem('token', data.token); // simpan token saja, bukan seluruh state
  return data.user;
}
```

Jika mau, saya bisa bantu sekalian menulis ulang `script.js` agar
terhubung penuh ke API ini (kasir, barang, dashboard) — tinggal bilang saja.

## Keamanan Sebelum Deploy ke Production
- Ganti `JWT_SECRET` dengan string acak yang panjang & rahasia.
- Ganti password akun `owner` default (`owner123`) segera setelah seeding.
- Nonaktifkan atau lindungi endpoint `/api/auth/register` agar tidak sembarang orang bisa membuat akun.
- Gunakan HTTPS saat deploy ke server publik.

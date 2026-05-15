# VenMachine - Smart Automated Vending Machine System

Proyek ini adalah implementasi *Smart Vending Machine* berbasis Web dan IoT yang memungkinkan pelanggan berbelanja menggunakan antarmuka web interaktif dengan sistem pengelolaan stok 2 tingkat (Gudang & Mesin), dan diintegrasikan secara *real-time* ke mikrokontroler (ESP32) menggunakan **protokol MQTT**.

Tujuan dari dokumen ini adalah sebagai panduan teknis bagi seluruh anggota tim untuk memahami bagaimana alur komunikasi Web ↔ API ↔ ESP32 bekerja.

---

## 🏛️ Arsitektur Sistem & Alur Kerja

Sistem ini terdiri dari 3 komponen utama yang saling berkomunikasi:
1. **Frontend (React.js)**: Antarmuka UI pelanggan dan Admin.
2. **Backend (FastAPI)**: Pusat logika bisnis dan manipulasi *Database* (PostgreSQL).
3. **Perangkat Keras (ESP32)**: Menggerakkan motor *vending* dan sensor stok.

**Alur Kerja Utama (Berbelanja & Restock):**
1. Pembeli mengakses web via kode QR per-gate (`/user?gate=gate_1`).
2. Pembeli memilih barang dan melakukan pembayaran.
3. Web mengirim perintah MQTT ke mesin untuk mengeluarkan barang (Dispense).
4. Jika stok yang ada di mesin kurang dari 2, web/ESP32 akan mengirim sinyal restock.
5. ESP32 memindahkan stok fisik dari gudang mesin ke etalase depan.
6. ESP32 melapor via MQTT ke Web bahwa restock berhasil.
7. Web memanggil API Backend untuk memindahkan angka `warehouse_stock` ke `machine_stock` secara otomatis di database.

---

## 📦 Sistem Inventaris 2 Tingkat (Two-Tier Stock)

Untuk mensimulasikan penyimpanan pada *vending machine* berukuran besar, stok produk dipisah menjadi dua kolom pada database tabel `items`:

*   **`machine_stock`**: Stok yang saat ini **terpajang di etalase** *vending machine* dan siap dibeli. (Kapasitas maksimal: **10** per produk).
*   **`warehouse_stock`**: Stok cadangan yang tersimpan **di ruang penyimpanan** (gudang/belakang mesin). 

Jika `machine_stock` menipis, mesin akan secara otomatis mengisi ulang dari `warehouse_stock`. Pembeli **hanya** bisa membeli barang selama `machine_stock` > 0.

---

## 📡 Komunikasi MQTT (Web ↔ ESP32)

Komunikasi antar sistem tidak menggunakan HTTP Request langsung ke ESP, melainkan menggunakan perantara **Broker MQTT** (misalnya HiveMQ) agar sistem bisa berjalan *asynchronous* dan *real-time*.

### 1. Perintah Keluarkan Barang / Dispense (Web → ESP32)
Saat pelanggan selesai membayar, Web akan mem-publish perintah ke mesin.

*   **Topic**: `vending/{machineId}/cmd`  *(Contoh: `vending/VM001/cmd` untuk Gate 1)*
*   **Arah**: Web/Frontend 👉 ESP32
*   **Payload JSON**:
    Berisi *array* dari ID barang yang dibeli. Jika pembeli membeli 2 buah barang dengan ID 1, maka angka 1 akan dikirim dua kali.
    ```json
    {
      "items": [1, 1, 2]
    }
    ```

### 2. Laporan Lintas-Cek Pengeluaran Fisik (ESP32 → Web)
Setiap kali ESP32 *selesai* menggerakkan motor untuk 1 buah barang, ESP32 harus melapor ke Web sebagai bukti (*crosscheck*) bahwa barang benar-benar keluar secara fisik.

*   **Topic**: `vending/stock`
*   **Arah**: ESP32 👉 Web/Frontend
*   **Payload JSON**:
    ```json
    {
      "item": 1
    }
    ```
*(Catatan: Pengurangan stok di database sudah dilakukan secara instan di awal pembayaran untuk mencegah pembeli lain mengambil stok yang sama / menghindari race-condition. Pesan MQTT ini digunakan web semata-mata sebagai log verifikasi fisik).*

### 2. Perintah Isi Ulang / Restock (Web → ESP32)
Jika setelah pembayaran `machine_stock` turun di bawah 2 unit, Web akan memerintahkan ESP32 untuk memindahkan barang dari belakang ke depan.

*   **Topic**: `vending/{machineId}/cmd`
*   **Arah**: Web/Frontend 👉 ESP32
*   **Payload JSON**:
    ```json
    {
      "command": "RESTOCK",
      "item_id": 1,
      "location_id": 3
    }
    ```

### 3. Konfirmasi Isi Ulang Selesai (ESP32 → Web)
Setelah motor pada ESP32 selesai memindahkan barang ke depan secara fisik, ESP32 **WAJIB** melapor balik ke Web agar tampilan stok di layar dan di database di-update.

*   **Topic**: `vending/{machineId}/status`
*   **Arah**: ESP32 👉 Web/Frontend
*   **Payload JSON**:
    ```json
    {
      "status": "RESTOCK_DONE",
      "item_id": 1
    }
    ```

> **Catatan untuk tim Hardware (ESP32):** ESP32 bebas melakukan *restock* secara mandiri (misal: jika mendeteksi barang habis lewat sensor infrared) tanpa harus menunggu perintah `RESTOCK` dari web. Web akan selalu *listen* (mendengarkan) status `RESTOCK_DONE` dan segera mengupdate database ketika pesan tersebut diterima.

---

## 🔌 Dokumentasi API Utama (FastAPI)

Semua *endpoint* API berjalan pada basis URL `http://localhost:8000`. Berikut adalah endpoint kunci untuk pengembangan:

### 1. Proses Pembayaran
*   **Endpoint:** `POST /api/payment`
*   **Fungsi:** Mengurangi `machine_stock` dan membuat catatan log transaksi.
*   **Payload Request:**
    ```json
    {
      "items": [
        {"item_id": 1, "quantity": 1, "price": 15000}
      ],
      "total_amount": 15000,
      "payment_method": "QRIS",
      "gate": "gate_1"
    }
    ```
*   **Response (Penting):** Mengembalikan data `dispensed_items` yang memuat sisa `remaining_machine_stock` terbaru. Angka inilah yang memicu web mengirim sinyal MQTT `RESTOCK` jika nilainya < 2.

### 2. Sinkronisasi Database Restock (Internal)
*   **Endpoint:** `POST /api/items/{item_id}/restock`
*   **Fungsi:** Memindahkan nilai `warehouse_stock` ke `machine_stock` secara atomik di database (hingga mesin kembali penuh maksimal 10).
*   **Trigger:** Otomatis dipanggil oleh Frontend React seketika setelah menerima pesan MQTT `RESTOCK_DONE` dari ESP32. Tidak perlu parameter JSON *body*.

### 3. Mendapatkan Daftar Produk
*   **Endpoint:** `GET /api/items`
*   **Response:**
    ```json
    [
      {
        "id": 1,
        "name": "Wortel Premium",
        "price": 15000,
        "machine_stock": 10,
        "warehouse_stock": 30,
        "location_code": "ROW1"
      }
    ]
    ```

---

## 🚀 Cara Menjalankan Project Secara Lokal

Sistem ini telah dibungkus sepenuhnya menggunakan **Docker** sehingga meminimalisir masalah *environment*.

1. Pastikan **Docker** dan **Docker Compose** telah terpasang.
2. Buka terminal di dalam *root folder* proyek `VenMachine/`.
3. Jika ini pertama kali dijalankan, atau jika Anda baru saja merubah skema struktur *database* di `db.sql`, jalankan:
   ```bash
   sudo docker compose down -v
   sudo docker compose up -d --build
   ```
4. Jika hanya ingin mematikan dan menghidupkan tanpa menghapus data (*restart* harian):
   ```bash
   sudo docker compose stop
   sudo docker compose start
   ```

**Akses Lokal:**
*   Frontend (Web): `http://localhost:5173`
*   Backend API (Swagger Docs): `http://localhost:8000/docs`

---
*Dokumentasi ini akan terus diperbarui sejalan dengan perkembangan integrasi Hardware-ke-Software tim capstone.*

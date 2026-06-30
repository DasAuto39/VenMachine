# VenMachine - Smart Automated Vending Machine System

VenMachine adalah implementasi *Smart Vending Machine* berbasis Web dan IoT yang memungkinkan pelanggan berbelanja menggunakan antarmuka e-commerce interaktif dengan integrasi **AI Chatbot Agentic**, sistem pengelolaan stok 2 tingkat (Gudang & Mesin), sistem pembayaran nirkontak (Midtrans QRIS), dan terintegrasi secara *real-time* ke mikrokontroler (ESP32) menggunakan **protokol MQTT**.

---

## 🏛️ Arsitektur Sistem & Alur Kerja

Sistem ini terdiri dari 3 lapis utama:
1. **Frontend (React.js + Vite + TailwindCSS)**: Antarmuka UI pelanggan dan Admin Dashboard yang dinamis.
2. **Backend (FastAPI + Python)**: Pusat logika bisnis, integrasi LLM Gemini, API pembayaran, dan manipulasi *Database* (PostgreSQL).
3. **Perangkat Keras (ESP32)**: Menggerakkan motor/spiral *vending* dan sensor stok fisik.

**Alur Kerja Utama (Berbelanja):**
1. Pembeli mengakses web via pindai kode QR per-gate mesin (contoh: `/user?gate=gate_1`).
2. Pembeli dapat menggunakan fitur **AI Assistant (Gemini 2.5 Flash)** yang otomatis akan merekomendasikan produk sesuai preferensi unik pengguna (Alergi, Rasa, dsb) dan memasukkannya langsung ke keranjang.
3. Pembeli melakukan *checkout* dan pembayaran (Midtrans).
4. Web mengirim perintah MQTT secara asinkronus ke ESP32 untuk mengeluarkan barang (*Dispense*).
5. ESP32 melapor kembali via MQTT ke Web memicu notifikasi sukses di layar pembeli.
6. (Otomatis) Jika stok di etalase/mesin menipis, web dan ESP32 bersinergi mensinkronisasi pengisian ulang dari cadangan `warehouse_stock` ke `machine_stock`.

---

## 🤖 AI Assistant (Agentic Gemini 2.5 Flash)

Fitur unggulan proyek ini adalah **AI Chatbot Pintar** yang revolusioner:
*   **Dynamic Context Injection**: Prompt yang dikirim ke AI secara dinamis disuntikkan dengan profil pengguna (*Tag Preferences* seperti "Alergi Susu Sapi", "Suka Pedas" - maks. 8 tag) ditambah katalog produk/stok yang sedang *real-time*. AI merespons *secara presisi* tanpa harus dijelaskan berulang-ulang oleh pembeli di obrolan!
*   **Agentic Workflow (action_items)**: AI pada sistem ini tidak sekadar berbincang. Apabila AI merekomendasikan produk, AI akan mengeluarkan respons dalam format struktur JSON, sehingga Frontend *secara otomatis* dapat menambahkan rekomendasi tersebut langsung ke Keranjang pembeli.
*   **Session-Storage Persistency**: Obrolan Anda akan tetap ada (tidak hilang) saat Anda berpindah-pindah halaman menu belanja. Obrolan hanya akan lenyap jika Anda me-refresh penuh browser (F5) untuk menjaga privasi.

---

## 📦 Sistem Inventaris & Normalisasi Tabel

Untuk mensimulasikan penyimpanan cerdas, stok produk dipisah ke dua kolom di tabel `items`:
*   **`machine_stock`**: Stok yang **terpajang fisik di etalase** (Maksimal: **10** per rak).
*   **`warehouse_stock`**: Stok cadangan di gudang (*storage*).
Database sepenuhnya dinormalisasi menggunakan *Foreign Key* kuat menuju tabel `categories` dan `storage_locations`. (Mendukung `ON UPDATE CASCADE`). Secara fisik, proyek Capstone/Tugas Akhir ini dibatasi pada 5 jumlah laci rak (`row_position`).

---

## 📡 Komunikasi MQTT (Web ↔ ESP32)

Komunikasi antar sistem tidak menggunakan HTTP Request langsung ke ESP, melainkan menggunakan perantara **Broker MQTT Publik** agar sistem berjalan *asynchronous* dan *real-time* dari mana saja asalkan terkoneksi internet.

### 🌐 Detail Konfigurasi Broker Saat Ini
Sistem web (Backend) saat ini telah di-*hardcode* untuk terkoneksi ke broker publik gratis dari EMQX. Untuk menghubungkan ESP32 milik Anda/teman Anda agar bisa membaca perintah dari Web, gunakan konfigurasi berikut di kode Arduino/C++ ESP32:

*   **Broker (Server)**: `broker.emqx.io`
*   **Port**: `1883`
*   **Username / Password**: *(Kosongkan, tidak perlu)*
*   **Client ID**: Gunakan ID acak (misal: `venmachine_esp32_123`) agar tidak bertabrakan dengan koneksi lain.

> 💡 **Cara Kerja:** Pastikan ESP32 terhubung ke Internet (Wi-Fi/Hotspot). Selama ESP32 dan Laptop (Web Server) sama-sama terhubung ke internet dan me-*listen* ke broker `broker.emqx.io`, sistem akan saling terhubung dengan lancar meskipun berbeda jaringan!

### 1. Meminta Konfigurasi Aktif (ESP32 → Web)
Digunakan oleh ESP32 (biasanya saat baru menyala/restart) untuk menanyakan index motor mana saja yang saat ini ada produknya di database.
*   **Topic**: `vending/request_config`
*   **Arah**: ESP32 👉 Web (Backend)
*   **Payload JSON**:
    ```json
    {
      "msg": "REQUEST_DATA_BARANG"
    }
    ```

### 2. Sinkronisasi Konfigurasi (Web → ESP32)
Merupakan balasan dari Web saat ESP32 melakukan request, ATAU dipancarkan otomatis (Broadcast) oleh Web **setiap kali Admin menambah produk baru, mengedit, atau menghapus produk** di website.
*   **Topic**: `vending/config`
*   **Arah**: Web (Backend) 👉 ESP32
*   **Payload JSON**:
    Berisi *array* dari Lokasi Rak/Slot (`location_id`) yang sedang aktif. Karena yang dikirim adalah angka Laci Fisiknya, ESP32 bisa langsung mencocokkannya dengan motor tanpa peduli berapapun ID di database.
    ```json
    {
      "active_indexes": [1, 2, 3, 5, 6, 7]
    }
    ```

### 3. Perintah Keluarkan Barang / Dispense (Web → ESP32)
Saat pelanggan selesai membayar via Midtrans, Web akan mem-publish perintah ke mesin spesifik (gate tertentu) untuk menjatuhkan barang.
*   **Topic**: `vending/{machineId}/cmd` *(Contoh: `vending/VM001/cmd` untuk Gate 1)*
*   **Arah**: Web (Backend) 👉 ESP32
*   **Payload JSON**:
    Berisi *array* dari Nomor Laci/Motor (`location_id`) yang barangnya dibeli. ESP32 bisa langsung memutar motor sesuai angka ini.
    ```json
    {
      "items": [1, 1, 2]
    }
    ```

### 4. Laporan Eksekusi Dispense (ESP32 → Web)
Setiap kali ESP32 *selesai* menjatuhkan barang fisik, ia mempublikasikan pesan balik ke web:
*   **Topik Notifikasi Frontend**: `vending/stock` -> `{"item": 101}`

---

## 🔌 Endpoint API Utama (FastAPI)

REST API dapat diakses di `http://localhost:8000/docs` (Swagger UI).
*   `POST /api/chat`: Menyatukan riwayat obrolan, preferensi profil, dan stok, lalu meneruskannya ke Gemini.
*   `POST /api/checkout`: Mengunci stok sementara dan menerbitkan `transaction_id`.
*   `POST /api/midtrans/token`: Interkoneksi SDK Midtrans untuk Snap Token pembayaran.
*   `POST /api/payment`: Verifikasi akhir setelah QRIS sukses dan pemicu utama publish perintah *Dispense* MQTT.

---

## 🌍 Setup Ngrok (Solusi Akses Publik & Mixed Content)

Agar *smartphone* pelanggan yang berbeda jaringan WiFi dapat memindai QR dan memesan dengan aman (HTTPS), sistem ini ditenagai oleh **Ngrok**. 
*   **Penangkal Mixed Content**: Vite Frontend dikonfigurasi sebagai *Proxy internal*. Oleh karena itu, *variabel lingkungan* `VITE_API_BASE_URL` disengaja dibiarkan *kosong*, supaya panggilan API dari HP menggunakan URL relatif (`/api/items`) yang kemudian dicegat oleh Vite di *localhost* Laptop dan dibelokkan ke peladen Backend Docker. Ini mencegah browser HP memblokir *request*!

Jalankan perintah ini di laptop *host*:
```bash
ngrok http 5173 --domain=domain-anda.ngrok-free.dev
```

---

## 🛠️ Panduan Setup & Instalasi (Dari Nol)

Sistem ini telah dibungkus seluruhnya ke dalam kontainer (**Docker**), sehingga Anda terbebas dari kerumitan instalasi dependensi rumit (Python, Node.js, atau PostgreSQL) di perangkat lokal Anda.


### Langkah 1: Kloning Repositori
Buka terminal (Command Prompt / PowerShell / Terminal), arahkan ke folder kerja Anda, lalu ketik perintah berikut:
```bash
git clone https://github.com/DasAuto39/VenMachine.git
cd VenMachine
```

### Langkah 2: Konfigurasi Environment (Kredensial Rahasia)
Proyek ini membutuhkan Kunci API (*API Keys*) agar AI Gemini dan Sistem Pembayaran Midtrans dapat bekerja.
1. Salin file *template* yang telah kami sediakan:
   *   *(Di Windows CMD/PowerShell)*: `copy .env.example .env`
   *   *(Di Linux/Mac/Git Bash)*: `cp .env.example .env`
2. Buka file `.env` yang baru terbentuk (di *root* folder) menggunakan *Text Editor* (seperti VS Code atau Notepad).
3. Isi parameter yang kosong, yang terpenting adalah:
   *   `GEMINI_API_KEY`: Dapatkan gratis dari Google AI Studio.
   *   `MIDTRANS_SERVER_KEY`: Dapatkan dari *Dashboard Sandbox Midtrans* Anda.
   *   `VITE_MIDTRANS_CLIENT_KEY`: Kunci klien Midtrans (dari menu *Settings* -> *Access Keys* Midtrans).

### Langkah 3: Menjalankan Sistem (Build & Run)
Setelah konfigurasi rahasia Anda tersimpan, saatnya menyalakan mesin uatamanya. Jalankan perintah ini:
```bash
docker compose up -d --build
```
> ⏳ **Penting:** Jika ini adalah kali pertama Anda menjalankannya, Docker akan mengunduh *image* basis (Node, Python, PostgreSQL) yang ukurannya bisa mencapai ratusan *Megabytes*. Harap bersabar menunggu (bisa memakan waktu 5-15 menit tergantung kecepatan internet Anda).

### Langkah 4: Mengakses Web
Jika terminal sudah tidak bekerja dan menampilkan pesan hijau `Started` atau `Running` pada semua kontainer, buka *browser* Anda:
*   **Web Pelanggan / Frontend**: `http://localhost:5173`
*   **Panel Database/API (Swagger)**: `http://localhost:8000/docs`

---

## 🔐 Manajemen Akun Admin

Untuk membuka dasbor Administrator (pengelola mesin):
1. Daftar (*Register*) akun biasa dari halaman web.
2. Berikan hak akses *God Mode* (Admin) menggunakan perintah SQL di terminal PostgreSQL Anda:
   ```sql
   UPDATE users SET role = 'admin' WHERE username = 'nama_anda';
   ```
3. Keluar (Logout) dan masuk kembali (Login) untuk memunculkan tombol menu **Dashboard Admin**.

---
*Dokumentasi ini mencerminkan pembaruan kode terkini per Juni 2026.*

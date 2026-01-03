# BE-KriyaLogic

Backend API untuk aplikasi KriyaLogic, dibangun menggunakan Node.js, Express, dan MongoDB.

## Prasyarat

Sebelum memulai, pastikan Anda telah menginstal:

- [Node.js](https://nodejs.org/) (v14 atau lebih baru)
- [MongoDB](https://www.mongodb.com/) (Local atau Atlas)
- [Git](https://git-scm.com/)

## Instalasi

1.  Clone repository ini:
    ```bash
    git clone <repository_url>
    cd be-kriyalogic
    ```

2.  Instal dependensi:
    ```bash
    npm install
    ```

## Konfigurasi

1.  Buat file `.env` di root project dengan menyalin dari `.env.example`:
    ```bash
    cp .env.example .env
    ```
    *(Atau buat file `.env` secara manual)*

2.  Isi variabel lingkungan di file `.env`:
    ```env
    PORT=5000
    MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
    JWT_SECRET=rahasia_jwt_anda
    EMAIL_API_KEY=re_123456789  # API Key dari Resend untuk fitur email
    APP_URL=http://localhost:5173 # URL Frontend untuk redirect magic link
    ```

## Seeding Data
Untuk mengisi database dengan data awal (Admin & Cashier default):
```bash
npm run seed
```
Script ini akan membuat user Admin (`admin@kriyalogic.com`) dan Cashier (`cashier@kriyalogic.com`) jika belum ada.

## Menjalankan Aplikasi

### Mode Development
Untuk menjalankan aplikasi dengan hot-reload (menggunakan nodemon):
```bash
npm run dev
```

### Mode Production
Untuk menjalankan aplikasi secara normal:
```bash
npm start
```

## Dokumentasi API
Dokumentasi lengkap endpoint API tersedia di file `docs.md`.

## Struktur Project
- `src/config`: Konfigurasi database dan lainnya.
- `src/controllers`: Logika bisnis untuk setiap endpoint.
- `src/middleware`: Middleware Express (Auth, Error handling, dll).
- `src/models`: Schema Mongoose.
- `src/routes`: Definisi route API.
- `src/scripts`: Script utilitas (seperti seeding).
- `src/index.js`: Entry point aplikasi.

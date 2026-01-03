# Dokumentasi API KriyaLogic

## Base URL
`http://localhost:5000/api/v1`

## Endpoints

### 1. Root Endpoint
Mengembalikan status dasar API v1.

- **URL**: `/`
- **Method**: `GET`
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "message": "Welcome to KriyaLogic API v1",
    "version": "1.0.0"
  }
  ```

### 2. Authentication

#### Login
Login untuk mendapatkan token akses.

- **URL**: `/auth/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "admin@kriyalogic.com",
    "password": "password123"
  }
  ```
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "token": "ey...",
    "user": {
      "id": "60d0...",
      "username": "Admin User",
      "email": "admin@kriyalogic.com",
      "role": "admin"
    }
  }
  ```
- **Response Error (401)**:
  ```json
  {
    "success": false,
    "message": "Invalid credentials"]
  }
  ```

#### Forgot Password
Mengirimkan email berisi link reset password saat user lupa password.

- **URL**: `/auth/forgot-password`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@kriyalogic.com"
  }
  ```
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "data": "Email sent"
  }
  ```
- **Response Error (404)**:
  ```json
  {
    "success": false,
    "message": "There is no user with that email"
  }
  ```

#### Reset Password
Mengatur password baru menggunakan token dari email forgot password.

- **URL**: `/auth/reset-password/:resettoken`
- **Method**: `PUT`
- **URL Params**: `resettoken` (didapat dari link email)
- **Body**:
  ```json
  {
    "password": "newpassword123"
  }
  ```
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "message": "Password reset successful"
  }
  ```
- **Response Error (400)**:
  ```json
  {
    "success": false,
    "message": "Invalid token"
  }
  ```

### 3. Users

#### Create Cashier
Membuat user baru dengan role cashier. Hanya bisa diakses oleh Admin.

- **URL**: `/users/cashier`
- **Method**: `POST`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Body**:
  ```json
  {
    "username": "Ahmad Dahlan",
    "email": "ahmad@kriyalogic.com",
    "password": "password123"
  }
  ```
- **Response Success (201)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "60d0...",
      "username": "Ahmad Dahlan",
      "email": "ahmad@kriyalogic.com",
      "role": "cashier",
      "status": "active"
    }
  }
  ```
- **Response Error (403)**:
  ```json
  {
    "success": false,
    "message": "User role cashier is not authorized to access this route"
  }
  ```

#### Get All Cashiers
Mengambil semua data user dengan role cashier. Hanya bisa diakses oleh Admin.

- **URL**: `/users/cashiers`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "count": 2,
    "data": [
      {
        "role": "cashier",
        "status": "active",
        "_id": "60d0...",
        "username": "Ahmad Dahlan",
        "email": "ahmad@kriyalogic.com",
        "createdAt": "2023-01-01T00:00:00.000Z"
      },
      {
        "role": "cashier",
        "status": "inactive",
        "_id": "60d1...",
        "username": "Cashier Two",
        "email": "cashier2@kriyalogic.com",
        "createdAt": "2023-01-02T00:00:00.000Z"
      }
    ]
  }
  ```


#### Update Cashier
Memperbarui data user dengan role cashier. Hanya bisa diakses oleh Admin.

- **URL**: `/users/cashier/:id`
- **Method**: `PUT`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Body** (optional):
  ```json
  {
    "username": "New Username",
    "email": "newemail@kriyalogic.com",
    "password": "newpassword123",
    "status": "active"
  }
  ```
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "60d0...",
      "username": "New Username",
      "email": "newemail@kriyalogic.com",
      "role": "cashier",
      "status": "active"
    }
  }
  ```
- **Response Error (404)**:
  ```json
  {
    "success": false,
    "message": "User not found"
  }
  ```
- **Response Error (400)**:
  ```json
  {
    "success": false,
    "message": "Email already exists"
  }
  ```

#### Delete Cashier
Menghapus user dengan role cashier. Hanya bisa diakses oleh Admin.

- **URL**: `/users/cashier/:id`
- **Method**: `DELETE`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "message": "Cashier deleted successfully"
  }
  ```
- **Response Error (404)**:
  ```json
  {
    "success": false,
    "message": "User not found"
  }
  ```
- **Response Error (400)**:
  ```json
  {
    "success": false,
    "message": "User is not a cashier"
  }
  ```

### 4. Artisans

#### Create Artisan
Membuat data artisan baru. Hanya bisa diakses oleh Admin.

- **URL**: `/artisans`
- **Method**: `POST`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Body**:
  ```json
  {
    "fullName": "Budi Santoso",
    "phoneNumber": "081234567890",
    "commissionRate": 10,
    "bankAccount": "BCA 1234567890",
    "address": "Jl. Merdeka No. 10, Jakarta"
  }
  ```
- **Response Success (201)**:
  ```json
  {
    "success": true,
    "data": {
      "fullName": "Budi Santoso",
      "phoneNumber": "081234567890",
      "commissionRate": 10,
      "bankAccount": "BCA 1234567890",
      "address": "Jl. Merdeka No. 10, Jakarta",
      "_id": "60d0...",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "__v": 0
    }
  }
  ```
- **Response Error (400)**:
  ```json
  {
    "success": false,
    "message": "Phone number already exists"
  }
  ```

#### Get All Artisans
Mengambil semua data artisan. Hanya bisa diakses oleh Admin.

- **URL**: `/artisans`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "fullName": "Budi Santoso",
        "phoneNumber": "081234567890",
        "commissionRate": 10,
        "bankAccount": "BCA 1234567890",
        "address": "Jl. Merdeka No. 10, Jakarta",
        "_id": "60d0...",
        "createdAt": "2023-01-01T00:00:00.000Z",
        "__v": 0
      }
    ]
  }
  ```

#### Update Artisan
Memperbarui data artisan. Hanya bisa diakses oleh Admin.

- **URL**: `/artisans/:id`
- **Method**: `PUT`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Body** (optional):
  ```json
  {
    "fullName": "New Name",
    "phoneNumber": "08123456789",
    "commissionRate": 15,
    "bankAccount": "BCA 1234567890",
    "address": "New Address"
  }
  ```
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "data": {
      "fullName": "New Name",
      "phoneNumber": "08123456789",
      "commissionRate": 15,
      "bankAccount": "BCA 1234567890",
      "address": "New Address",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "_id": "60d0..."
    }
  }
  ```
- **Response Error (404)**:
  ```json
  {
    "success": false,
    "message": "Artisan not found"
  }
  ```
- **Response Error (400)**:
  ```json
  {
    "success": false,
    "message": "Phone number already exists"]
  }
  ```

#### Delete Artisan
Menghapus data artisan. Hanya bisa diakses oleh Admin.

- **URL**: `/artisans/:id`
- **Method**: `DELETE`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "message": "Artisan deleted successfully"
  }
  ```
- **Response Error (404)**:
  ```json
  {
    "success": false,
    "message": "Artisan not found"]
  }
  ```

### 5. Guides

#### Create Guide
Membuat data guide baru. Hanya bisa diakses oleh Admin.

- **URL**: `/guides`
- **Method**: `POST`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Body**:
  ```json
  {
    "guideName": "Guide One",
    "agency": "Travel Agency A",
    "commissionRate": 15,
    "contact": "081298765432"
  }
  ```
- **Response Success (201)**:
  ```json
  {
    "success": true,
    "data": {
      "guideName": "Guide One",
      "agency": "Travel Agency A",
      "commissionRate": 15,
      "contact": "081298765432",
      "_id": "60d0...",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "__v": 0
    }
  }
  ```
- **Response Error (400)**:
  ```json
  {
    "success": false,
    "message": "Please provide all required fields"
  }
  ```


#### Update Guide
Mengupdate data guide. Hanya bisa diakses oleh Admin.

- **URL**: `/guides/:id`
- **Method**: `PUT`
- **Headers**:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer <admin_token>`
- **Body**:
  ```json
  {
    "guideName": "Budi Santoso Update",
    "agency": "Bali Tours Update",
    "commissionRate": 15,
    "contact": "081234567890"
  }
  ```
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "60d0fe4f5311236168a109ca",
      "guideName": "Budi Santoso Update",
      "agency": "Bali Tours Update",
      "commissionRate": 15,
      "contact": "081234567890",
      "createdAt": "2021-06-21T10:00:00.000Z",
      "__v": 0
    }
  }
  ```
- **Response Error (404)**:
  ```json
  {
    "success": false,
    "message": "Guide not found"
  }
  ```


#### Get All Guides
Mengambil semua data guide. Hanya bisa diakses oleh Admin.

- **URL**: `/guides`
- **Method**: `GET`
- **Headers**:
  - `Authorization`: `Bearer <admin_token>`
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "count": 1,
    "data": [
      {
        "guideName": "Guide One",
        "agency": "Travel Agency A",
        "commissionRate": 15,
        "contact": "081298765432",
        "_id": "60d0...",
        "createdAt": "2023-01-01T00:00:00.000Z",
        "__v": 0
      }
    ]
  }
  ```

#### Delete Guide
Menghapus data guide. Hanya bisa diakses oleh Admin.

- **URL**: `/guides/:id`
- **Method**: `DELETE`
- **Headers**:
  - `Content-Type`: `application/json`
  - `Authorization`: `Bearer <admin_token>`
- **Response Success (200)**:
  ```json
  {
    "success": true,
    "message": "Guide deleted successfully"
  }
  ```
- **Response Error (404)**:
  ```json
  {
    "success": false,
    "message": "Guide not found"
  }
  ```

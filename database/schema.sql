-- ============================================================
-- Dekyiba Hotel Management System — Database Schema
-- Engine: MySQL 8.0+
-- ============================================================

DROP DATABASE IF EXISTS dekyiba_hotel;
CREATE DATABASE dekyiba_hotel;
USE dekyiba_hotel;

-- ------------------------------------------------------------
-- Rooms
-- Bed/room type: Queen Size, Double Bed, Single
-- ------------------------------------------------------------
CREATE TABLE rooms (
    room_id         INT AUTO_INCREMENT PRIMARY KEY,
    room_number     VARCHAR(10) NOT NULL UNIQUE,
    room_type       ENUM('Single', 'Double Bed', 'Queen Size') NOT NULL,
    description     TEXT,
    price_per_night DECIMAL(10,2) NOT NULL,
    capacity        TINYINT UNSIGNED NOT NULL DEFAULT 2,
    image_url       VARCHAR(255) DEFAULT NULL,
    status          ENUM('available', 'maintenance', 'unavailable') NOT NULL DEFAULT 'available',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Guests
-- ------------------------------------------------------------
CREATE TABLE guests (
    guest_id     INT AUTO_INCREMENT PRIMARY KEY,
    full_name    VARCHAR(120) NOT NULL,
    email        VARCHAR(120) NOT NULL,
    phone        VARCHAR(25) NOT NULL,
    id_number    VARCHAR(50) DEFAULT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Bookings
-- ------------------------------------------------------------
CREATE TABLE bookings (
    booking_id     INT AUTO_INCREMENT PRIMARY KEY,
    room_id        INT NOT NULL,
    guest_id       INT NOT NULL,
    check_in       DATE NOT NULL,
    check_out      DATE NOT NULL,
    num_guests     TINYINT UNSIGNED NOT NULL DEFAULT 1,
    status         ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled') NOT NULL DEFAULT 'pending',
    total_amount   DECIMAL(10,2) NOT NULL,
    special_request TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE RESTRICT,
    FOREIGN KEY (guest_id) REFERENCES guests(guest_id) ON DELETE CASCADE,
    CHECK (check_out > check_in)
);

-- ------------------------------------------------------------
-- Staff accounts — managers use the Admin portal, everyone else
-- is an Employee account created from the Employees page and
-- signs in through the Employee portal on the login screen.
-- is_checked_in / last_login_at / last_logout_at track whether a
-- staff member is currently signed in, for the Employees page.
-- ------------------------------------------------------------
CREATE TABLE admins (
    admin_id        INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    role            ENUM('manager', 'employee') NOT NULL DEFAULT 'employee',
    is_checked_in   TINYINT(1) NOT NULL DEFAULT 0,
    last_login_at   TIMESTAMP NULL DEFAULT NULL,
    last_logout_at  TIMESTAMP NULL DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Helpful index for availability lookups
-- ------------------------------------------------------------
CREATE INDEX idx_bookings_dates ON bookings(room_id, check_in, check_out, status);

-- ------------------------------------------------------------
-- Seed data — rooms
-- ------------------------------------------------------------
INSERT INTO rooms (room_number, room_type, description, price_per_night, capacity, image_url, status) VALUES
('101', 'Single', 'Cosy single-bed room with a garden view and free Wi-Fi. Perfect for solo travellers or short stays.', 280.00, 1, '/images/room-single.jpg', 'available'),
('102', 'Single', 'Cosy single-bed room with a garden view and free Wi-Fi. Perfect for solo travellers or short stays.', 280.00, 1, '/images/room-single.jpg', 'available'),
('201', 'Double Bed', 'Comfortable double-bed room with a sitting area and pool view. Includes breakfast for two.', 480.00, 2, '/images/room-double.jpg', 'available'),
('202', 'Double Bed', 'Comfortable double-bed room with a sitting area and pool view. Includes breakfast for two.', 480.00, 2, '/images/room-double.jpg', 'available'),
('301', 'Queen Size', 'Spacious queen-size room with a work desk and city view. Ideal for business travellers or couples.', 680.00, 3, '/images/room-queen.jpg', 'available'),
('401', 'Queen Size', 'Our largest queen-size room: private balcony, dining area, and dedicated turn-down service.', 950.00, 4, '/images/room-queen.jpg', 'available');

-- ------------------------------------------------------------
-- Seed data — default manager admin (username: kipsta / password below)
-- Password hash below is a bcrypt hash generated at setup time by seed.js
-- ------------------------------------------------------------
-- (Inserted by server/seed.js instead of here, since bcrypt hashing needs Node)

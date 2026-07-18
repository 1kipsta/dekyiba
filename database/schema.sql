-- ============================================================
-- Dekyiba Hotel Management System — Database Schema
-- Engine: PostgreSQL (designed for Neon, via Vercel Storage)
-- ============================================================
-- Run this ONCE against a fresh, empty Postgres database. It drops and
-- recreates every table, so never run it again afterwards against a
-- database that has real data in it — that would wipe everything.

DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS guests CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS hotel_settings CASCADE;
DROP TABLE IF EXISTS restaurant_menu_items CASCADE;
DROP TABLE IF EXISTS restaurant_sales CASCADE;
DROP TABLE IF EXISTS bar_orders CASCADE;

-- ------------------------------------------------------------
-- Rooms
-- Bed/room type: Queen Size, Double Bed, Single
-- ------------------------------------------------------------
CREATE TABLE rooms (
    room_id         SERIAL PRIMARY KEY,
    room_number     VARCHAR(10) NOT NULL UNIQUE,
    room_type       TEXT NOT NULL CHECK (room_type IN ('Single', 'Double Bed', 'Queen Size')),
    description     TEXT,
    price_per_night DECIMAL(10,2) NOT NULL,
    capacity        SMALLINT NOT NULL DEFAULT 2,
    image_url       VARCHAR(255) DEFAULT NULL,
    status          TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'maintenance', 'unavailable')),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Guests
-- ------------------------------------------------------------
CREATE TABLE guests (
    guest_id     SERIAL PRIMARY KEY,
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
    booking_id      SERIAL PRIMARY KEY,
    room_id         INT NOT NULL REFERENCES rooms(room_id) ON DELETE RESTRICT,
    guest_id        INT NOT NULL REFERENCES guests(guest_id) ON DELETE CASCADE,
    check_in        DATE NOT NULL,
    check_out       DATE NOT NULL,
    num_guests      SMALLINT NOT NULL DEFAULT 1,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
    total_amount    DECIMAL(10,2) NOT NULL,
    special_request TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    admin_id        SERIAL PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(120) NOT NULL,
    role            TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('manager', 'employee')),
    is_checked_in   BOOLEAN NOT NULL DEFAULT false,
    last_login_at   TIMESTAMP NULL DEFAULT NULL,
    last_logout_at  TIMESTAMP NULL DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Helpful index for availability lookups
-- ------------------------------------------------------------
CREATE INDEX idx_bookings_dates ON bookings(room_id, check_in, check_out, status);

-- ------------------------------------------------------------
-- Restaurant / bar tables — these are also created automatically by the
-- app itself on first request (see ensureTables() in
-- server/routes/management.js), but are included here too so a fresh
-- database has them from the start.
-- ------------------------------------------------------------
CREATE TABLE hotel_settings (
    setting_key     VARCHAR(80) PRIMARY KEY,
    setting_value   TEXT NOT NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE restaurant_menu_items (
    menu_item_id    SERIAL PRIMARY KEY,
    name            VARCHAR(120) NOT NULL,
    category        VARCHAR(80) NOT NULL DEFAULT 'General',
    department      TEXT NOT NULL DEFAULT 'restaurant' CHECK (department IN ('restaurant', 'bar')),
    price           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    description     TEXT,
    image_url       VARCHAR(255) DEFAULT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE restaurant_sales (
    sale_id         SERIAL PRIMARY KEY,
    item_name       VARCHAR(120) NOT NULL,
    category        VARCHAR(80) NOT NULL DEFAULT 'General',
    quantity        SMALLINT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'paid', 'cancelled')),
    notes           TEXT,
    sold_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bar_orders (
    order_id        SERIAL PRIMARY KEY,
    guest_name      VARCHAR(120) NOT NULL,
    item_name       VARCHAR(120) NOT NULL,
    quantity        SMALLINT NOT NULL DEFAULT 1,
    unit_price      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount    DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'served', 'paid', 'cancelled')),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

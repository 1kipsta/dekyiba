# Dekyiba Hotel — Booking & Management System

A full-stack hotel booking and front-desk management system built for Dekyiba Hotel, Tarkwa.

- **Frontend:** HTML, CSS, vanilla JavaScript (no build step required)
- **Backend:** Node.js + Express (REST API)
- **Database:** MySQL
- **Auth:** JWT-based staff login (Admin/manager portal and Employee portal) with bcrypt-hashed passwords

## What's included

- **Home page** (`/`) — hotel overview and links into the operational pages below. Nav is trimmed to just "Home". Employees who sign in through the staff login land back here, and can then open the restaurant/bar order pages.
- **Book a room** (`/rooms.html`) — check live availability by date, browse rooms & suites (Single / Double Bed / Queen Size), and reserve a room; all room search and booking happens on this dedicated page.
- **Take restaurant orders** (`/restaurant-orders.html`) — a Bookings-page-style screen where any signed-in staff member (manager or employee) records restaurant sales. Requires staff sign-in; guests without a staff session are redirected to the login page.
- **Record bar sales** (`/bar-orders.html`) — the equivalent page for bar orders.
- **Staff login** (`/admin/login.html`) — Admin tab and Employee tab. The Admin tab only accepts manager accounts and opens the admin dashboard; the Employee tab only accepts employee accounts and returns to the home page. Signing in/out is recorded on the account (checked in / checked out).
- **Admin dashboard** (`/admin`, manager-only) —
  - **Bookings** — occupancy stats, monthly revenue, room manager (add/edit/delete rooms), and a bookings table where staff move a reservation through pending → confirmed → checked in → checked out.
  - **Restaurant** — menu management and a live, read-only sales overview (order-taking itself happens on the public restaurant-orders page).
  - **Bar** — bar item setup and a live, read-only order ledger (order-taking happens on the public bar-orders page).
  - **Employees** — create employee/manager accounts and see who is currently checked in.
  - **Accounts Manager** (formerly "Reservations") — room inventory, bookings, and the revenue report/CSV export.
  - **Settings** — hotel identity and reporting defaults.
  - Every admin page shows a shared live top bar with today's combined sales and delivered-order counts, updated whenever a restaurant or bar sale is recorded.
- **REST API** covering rooms, bookings, restaurant/bar orders, and authentication.

## Project structure

```
dekyiba-hotel/
├── database/
│   └── schema.sql            # Tables + sample rooms
├── server/                   # Express API
│   ├── routes/
│   │   ├── rooms.js
│   │   ├── bookings.js
│   │   ├── management.js     # Employees, restaurant, bar, settings, reports
│   │   └── auth.js           # Portal-aware login + logout
│   ├── middleware/auth.js    # JWT guard (requireAuth / requireManager)
│   ├── db.js                 # MySQL connection pool
│   ├── seed.js                # Creates the default manager account
│   ├── server.js
│   └── .env.example
├── public/                    # Frontend (served by Express)
│   ├── index.html              # Home page (Home-only nav, staff status, service cards)
│   ├── rooms.html               # Book a room — availability search, room grid, booking
│   ├── restaurant-orders.html   # Staff-only: take restaurant orders
│   ├── bar-orders.html          # Staff-only: record bar sales
│   ├── css/style.css
│   ├── js/rooms.js               # Availability search + booking logic for rooms.html
│   ├── js/service-hub.js         # Home page staff status + service card routing
│   ├── js/staff-auth.js          # Shared staff session helper (public pages)
│   ├── js/restaurant-orders.js
│   ├── js/bar-orders.js
│   └── admin/
│       ├── login.html            # Admin / Employee portal tabs
│       ├── dashboard.html        # Bookings + room manager
│       ├── restaurant.html       # Menu management + live sales overview
│       ├── bar.html              # Bar item setup + live order ledger
│       ├── employees.html        # Employee accounts + sign-in status
│       ├── accounts-manager.html # Room inventory, bookings, reports (was reservations.html)
│       ├── settings.html
│       ├── css/admin.css
│       └── js/
├── setup.sh
└── README.md
```

## Requirements

- Node.js 18 or later
- MySQL 8.0 or later (running locally or reachable over the network)

## Setup

1. **Unzip the project and open a terminal in the `dekyiba-hotel` folder.**

2. **Run the setup script:**
   ```bash
   bash setup.sh
   ```
   The first run creates `server/.env` from the template and stops so you can fill in your MySQL credentials. Open `server/.env` and set:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=dekyiba_hotel
   JWT_SECRET=some_long_random_string
   ```

3. **Run the script again:**
   ```bash
   bash setup.sh
   ```
   This installs dependencies, creates the database from `database/schema.sql`, seeds 6 sample rooms, and creates a default manager account.

   Default manager login (change the password after first sign-in) — use the **Admin** tab on the staff login page:
   - **username:** `kipsta`
   - **password:** `Dekyiba@2026` (or whatever you set as `ADMIN_DEFAULT_PASSWORD` in `.env`)

   Employee accounts are not seeded — create them from **Employees** in the admin dashboard after your first manager sign-in. Employees sign in from the **Employee** tab on the staff login page.

4. **Start the server:**
   ```bash
   cd server
   npm start
   ```

5. **Open the site:**
   - Guest booking site: http://localhost:4000
   - Staff login: http://localhost:4000/admin/login.html

### If `mysql` command isn't available / manual DB setup

If `setup.sh` can't reach your `mysql` CLI, run the schema manually instead:
```bash
mysql -u root -p < database/schema.sql
cd server
npm install
npm run seed
npm start
```

## API reference

| Method | Endpoint                              | Auth              | Description                                          |
|--------|-----------------------------------------|-------------------|-------------------------------------------------------|
| GET    | `/api/rooms`                            | Public            | List rooms (optional `?check_in=&check_out=`)         |
| GET    | `/api/rooms/:id`                        | Public            | Room detail                                            |
| POST   | `/api/rooms`                            | Staff             | Add a room                                              |
| PATCH  | `/api/rooms/:id`                        | Staff             | Update a room                                           |
| DELETE | `/api/rooms/:id`                        | Staff             | Delete a room                                           |
| POST   | `/api/bookings`                         | Public            | Create a booking                                        |
| GET    | `/api/bookings`                         | Staff             | List bookings (optional `?status=`)                    |
| PATCH  | `/api/bookings/:id/status`              | Staff             | Update booking status                                   |
| GET    | `/api/bookings/stats/summary`           | Staff             | Dashboard stats                                          |
| POST   | `/api/auth/login`                       | Public            | `{ username, password, portal }` — `portal` is `admin` (manager only) or `employee` (employee only) |
| POST   | `/api/auth/logout`                      | Staff             | Marks the account as checked out                        |
| GET    | `/api/management/admins`                | Manager           | List employee/manager accounts + sign-in status         |
| POST   | `/api/management/admins`                | Manager           | Create an employee/manager account                      |
| GET    | `/api/management/restaurant/menu`       | Staff             | List menu items                                          |
| POST/PATCH/DELETE | `/api/management/restaurant/menu` | Manager     | Manage menu items                                         |
| POST   | `/api/management/restaurant/sales`      | Staff             | Record a restaurant sale (used by restaurant-orders.html) |
| GET    | `/api/management/restaurant/sales`      | Staff             | List restaurant sales (optional `?range=`)               |
| GET/POST | `/api/management/bar/orders`          | Staff             | List / record bar orders (used by bar-orders.html)       |
| PATCH  | `/api/management/bar/orders/:id/status` | Staff             | Update a bar order's status                              |
| GET    | `/api/management/bar/summary`           | Staff             | Bar revenue summary                                       |
| GET    | `/api/management/reports/today`         | Staff             | Combined today's sales / delivered orders (top bar)       |
| GET    | `/api/management/reports/summary`       | Manager           | Revenue report for the Accounts Manager page              |
| GET    | `/api/management/reports/export`        | Manager           | CSV export for the Accounts Manager page                  |
| GET/POST | `/api/management/settings`            | Manager           | Hotel settings                                             |

"Staff" means any signed-in account, manager or employee. "Manager" means the account's role must be `manager` — these are the routes behind the admin dashboard pages (Employees, Settings, Accounts Manager, menu management).

## Security fixes applied

- **Stored XSS:** guest/staff-submitted text (names, emails, item names, statuses) is now HTML-escaped before being rendered into admin/staff tables, closing a path where a public booking could plant a script that ran in a signed-in manager's browser and read their `localStorage` session token.
- **Path traversal in menu uploads:** the uploaded file name is now sanitized with `path.basename` and a strict allowlist of characters before being used to build a filesystem path.
- **CSV export:** report rows are now quoted and formula-injection-guarded (values starting with `=`, `+`, `-`, `@` get a leading apostrophe) so opening the export in Excel/Sheets can't trigger unexpected formulas.
- **Login rate limiting:** `/api/auth/login` is now capped at 10 attempts per IP per 15 minutes via `express-rate-limit` — run `npm install` in `server/` again after unzipping to pull in this new dependency.
- **Request size cap:** JSON bodies are capped at 8MB to bound the base64 upload payload.
- Bar order status updates are now validated against an allowlist, matching the pattern already used for booking status.

## Notes for your project write-up

- **Database design:** rooms, guests, bookings, and staff accounts (`admins` table) are normalized into separate tables with foreign keys; a `CHECK` constraint prevents `check_out <= check_in`, and a composite index on `bookings(room_id, check_in, check_out, status)` speeds up availability lookups. The `admins` table also tracks `is_checked_in`, `last_login_at`, and `last_logout_at` so the Employees page can show who is currently signed in.
- **Booking safety:** the booking endpoint wraps the room-lock, availability check, and insert in a single MySQL transaction (`FOR UPDATE`) to prevent two guests double-booking the same room at the same time.
- **Security:** passwords are hashed with bcrypt; staff routes are protected by JWT middleware; the Admin portal rejects employee accounts and vice versa at the login endpoint, and the admin dashboard pages redirect any non-manager session back to the home page as a second layer of protection.
- **Extending it:** natural next steps if you want to expand this for a bigger group project — payment integration (e.g. Paystack/MTN MoMo), email confirmations, a guest-facing "my booking" lookup page, or room photo uploads.

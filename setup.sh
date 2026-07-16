#!/bin/bash
# ============================================================
# Dekyiba Hotel — setup script
# Run this once from the project root: bash setup.sh
# Requires: Node.js (v18+) and a running MySQL server
# ============================================================

set -e

echo "=== Dekyiba Hotel setup ==="

# 1. Install backend dependencies
echo ""
echo "[1/4] Installing server dependencies..."
cd server
npm install

# 2. Set up .env if missing
if [ ! -f .env ]; then
  echo ""
  echo "[2/4] Creating .env from template..."
  cp .env.example .env
  echo "  -> server/.env created. Edit it with your MySQL credentials before continuing."
  echo "  -> Re-run this script after editing .env."
  exit 0
else
  echo ""
  echo "[2/4] .env already exists, skipping."
fi

# 3. Load DB credentials from .env and build the schema
echo ""
echo "[3/4] Building the database..."
export $(grep -v '^#' .env | xargs)
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" ${DB_PASSWORD:+-p"$DB_PASSWORD"} < ../database/schema.sql
echo "  -> Database '$DB_NAME' created and seeded with sample rooms."

# 4. Create the default admin account
echo ""
echo "[4/4] Creating default admin account..."
npm run seed

echo ""
echo "=== Setup complete ==="
echo "Start the server with:  cd server && npm start"
echo "Then visit:"
echo "  Guest site:  http://localhost:4000"
echo "  Staff login: http://localhost:4000/admin/login.html"

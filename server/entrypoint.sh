#!/bin/sh
set -e

echo "Dekyiba Hotel — starting up..."
node scripts/wait-for-db.js
node seed.js
echo "Starting server..."
exec node server.js

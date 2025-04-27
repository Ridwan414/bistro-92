#!/bin/bash

echo "Setting up Bistro92 database..."

# Make sure PostgreSQL is running
docker exec -it bistro92-backend-postgres-1 pg_isready -d bistro92 -U postgres -h localhost
if [ $? -ne 0 ]; then
    echo "PostgreSQL container is not running. Make sure it's started with docker-compose."
    exit 1
fi

# Apply updated schema
echo "Applying updated schema..."
docker exec -i bistro92-backend-postgres-1 psql -U postgres -d bistro92 < order-service/db/updated_schema.sql

# Seed data
echo "Seeding database with sample data..."
docker exec -i bistro92-backend-postgres-1 psql -U postgres -d bistro92 < order-service/db/seed_data.sql

echo "Database setup completed successfully."
echo "You can now query the database with:"
echo "  docker exec -it bistro92-backend-postgres-1 psql -U postgres -d bistro92"
echo ""
echo "Sample queries:"
echo "  SELECT * FROM menu_items;"
echo "  SELECT * FROM tables;"
echo "  SELECT * FROM orders;"
echo "  SELECT * FROM notifications;" 
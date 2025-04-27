#!/bin/bash

echo "Bistro 92 - Fix and Run Script"
echo "This script will fix module dependency issues and restart the application"

# Make the script exit on any error
set -e

# Navigate to project root
cd "$(dirname "$0")"

echo "===== Step 1: Properly initializing Go modules ====="

# Order Service
echo "Setting up Order Service modules..."
cd order-service
# Initialize go.sum file if needed
if [ ! -f go.sum ] || [ ! -s go.sum ]; then
    echo "Creating go.sum for Order Service..."
    # Force downloading all dependencies to generate go.sum
    go mod download
    go mod tidy
fi
cd ..

# Notification Service
echo "Setting up Notification Service modules..."
cd notification-service
# Initialize go.sum file if needed
if [ ! -f go.sum ] || [ ! -s go.sum ]; then
    echo "Creating go.sum for Notification Service..."
    # Force downloading all dependencies to generate go.sum
    go mod download
    go mod tidy
fi
cd ..

# Dashboard Service
echo "Setting up Dashboard Service modules..."
cd dashboard-service
# Initialize go.sum file if needed
if [ ! -f go.sum ] || [ ! -s go.sum ]; then
    echo "Creating go.sum for Dashboard Service..."
    # Force downloading all dependencies to generate go.sum
    go mod download
    go mod tidy
fi
cd ..

echo "===== Step 2: Verifying go.sum files ====="
for service in order-service notification-service dashboard-service; do
    if [ -f "$service/go.sum" ]; then
        echo "✅ $service/go.sum exists"
    else
        echo "❌ Failed to create $service/go.sum"
        exit 1
    fi
done

echo "===== Step 3: Restarting Docker Compose ====="
echo "Stopping any running containers..."
docker compose down --remove-orphans

echo "Building containers with no cache..."
docker compose build --no-cache

echo "Starting all services..."
docker compose up -d

echo "===== Step 4: Checking service status ====="
sleep 5
services=("order-service" "notification-service" "dashboard-service" "frontend" "postgres" "redis" "rabbitmq" "temporal")
for service in "${services[@]}"; do
    if docker compose ps "$service" | grep -q "Up"; then
        echo "✅ Service $service is running."
    else
        echo "❌ Service $service failed to start. Check logs with: docker compose logs $service"
    fi
done

echo ""
echo "Bistro 92 setup complete!"
echo "Frontend: http://localhost:3000"
echo "Order Service API: http://localhost:8000/orders"
echo "Notification Service WebSocket: ws://localhost:3001/ws"
echo "Dashboard Service API: http://localhost:5000/dashboard/metrics"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop the system: docker compose down" 
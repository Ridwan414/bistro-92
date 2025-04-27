#!/bin/bash

echo "Starting Bistro 92 Backend System..."

# Make sure we exit on error
set -e

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Docker is not running. Please start Docker first."
    exit 1
fi

# Run Docker Compose
echo "Starting services with Docker Compose..."
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

# Check if services are running
echo "Checking if services are running..."
sleep 5
services=("order-service" "notification-service" "dashboard-service" "frontend" "postgres" "redis" "rabbitmq" "temporal")
for service in "${services[@]}"; do
    if ! docker compose ps "$service" | grep -q "Up"; then
        echo "Service $service failed to start. Check logs with: docker compose logs $service"
    else
        echo "Service $service is running."
    fi
done

echo ""
echo "Bistro 92 is now running!"
echo "Frontend: http://localhost:3000"
echo "Order Service API: http://localhost:8000/orders"
echo "Notification Service WebSocket: ws://localhost:3001/ws"
echo "Dashboard Service API: http://localhost:5000/dashboard/metrics"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop the system: docker compose down" 
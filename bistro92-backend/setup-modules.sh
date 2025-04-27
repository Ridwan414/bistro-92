#!/bin/bash

# This script sets up the Go modules for all services

# Order Service
echo "Setting up Order Service modules..."
cd order-service
go mod download
go mod tidy
cd ..

# Notification Service
echo "Setting up Notification Service modules..."
cd notification-service
go mod download
go mod tidy
cd ..

# Dashboard Service
echo "Setting up Dashboard Service modules..."
cd dashboard-service
go mod download
go mod tidy
cd ..

echo "All modules have been set up." 
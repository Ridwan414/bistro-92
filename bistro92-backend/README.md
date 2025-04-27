# Bistro 92 Restaurant Management System

A comprehensive restaurant management system built with microservices architecture using Go, Temporal, and React.

## Architecture

This system consists of:

1. **Order Service** - REST API for creating and managing orders
2. **Notification Service** - WebSocket server for real-time notifications
3. **Dashboard Service** - Metrics and analytics API
4. **Frontend** - React-based web interface
5. **Supporting Infrastructure** - PostgreSQL, RabbitMQ, Redis, Temporal

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Go 1.16+ (for development)
- Node.js 16+ (for frontend development)

### Running the System

#### Option 1: Using the run script (Recommended)

1. Clone this repository
2. Set up the Go modules:
   ```bash
   ./setup-modules.sh
   ```
3. Start all services using the run script:
   ```bash
   ./run.sh
   ```

#### Option 2: Using Docker Compose manually

1. Clone this repository
2. Start all services using Docker Compose:
   ```bash
   docker compose build --no-cache
   docker compose up
   ```

3. Access the frontend at http://localhost:3000

### Accessing the System

- **Frontend Dashboard**: http://localhost:3000
- **Order Creation**: http://localhost:3000/orders
- **Kitchen Monitor**: http://localhost:3000/kitchen
- **API Endpoints**:
  - Order Service: http://localhost:8000/orders
  - Dashboard Metrics: http://localhost:5000/dashboard/metrics
  - Notification WebSocket: ws://localhost:3001/ws
  - Notification Client: http://localhost:3001/client
- **Management UIs**:
  - RabbitMQ: http://localhost:15672 (guest/guest)
  - Temporal: http://localhost:8080

## Services

### Frontend (React)

- Web interface for order creation, monitoring, and dashboard
- WebSocket integration for real-time updates
- Routes for Dashboard, Orders, and Kitchen views

### Order Service (Go)

- REST API for creating orders
- Temporal workflows for order processing
- PostgreSQL for data persistence

### Notification Service (Go)

- WebSocket server for real-time notifications
- Room-based broadcasting
- RabbitMQ integration for order events

### Dashboard Service (Go)

- REST API for metrics and analytics
- Redis caching for performance
- SQL aggregation queries for business insights

## Development

Each microservice can be developed and tested independently:

### Running Services Individually

**Order Service**:
```bash
cd order-service
go run main.go
```

**Notification Service**:
```bash
cd notification-service
go run main.go
```

**Dashboard Service**:
```bash
cd dashboard-service
go run main.go
```

**Frontend**:
```bash
cd frontend
npm install
npm start
```

## Troubleshooting

If you encounter issues with Docker Compose:

1. Make sure Docker is running
2. Try rebuilding the images without cache: `docker compose build --no-cache`
3. Check service logs: `docker compose logs service-name`
4. Verify that Go modules are properly set up using `./setup-modules.sh` 
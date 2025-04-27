# Bistro 92 Kitchen Monitoring System Guide

This guide explains how to use the enhanced kitchen monitoring system with dynamic order status management and notifications.

## Overview of Changes

The kitchen monitoring system has been enhanced with the following features:

1. **Real-time WebSocket-based Updates**: All order data is now fetched and updated in real-time
2. **Order Status Management**: Complete order lifecycle from Pending → In Progress → Ready → Completed
3. **Chef Assignment**: Orders can be assigned to specific chefs
4. **Table Filtering**: Orders can be filtered by table number
5. **Enhanced Database Schema**: Additional fields to track order status, assigned chef, and notifications
6. **API Integration**: Full REST API for order management
7. **Notification System**: Real-time notifications for order creation and status changes

## Database Setup

1. Start the Docker containers:
   ```bash
   docker-compose up -d postgres rabbitmq redis temporal temporal-ui
   ```

2. Run the database setup script:
   ```bash
   ./setup-db.sh
   ```

This will create and seed the database with menu items, tables, and sample orders.

## Running the Services

Start all services:

```bash
# Start the order service
cd order-service
go run main.go

# In another terminal, start the notification service
cd notification-service
go run main.go

# In another terminal, start the dashboard service
cd dashboard-service
go run main.go

# In another terminal, start the frontend
cd frontend
npm start
```

## API Endpoints

### Menu Items
- `GET /menu-items`: Get all menu items
- `GET /menu-items/:id`: Get a specific menu item

### Tables
- `GET /tables`: Get all tables
- `GET /tables/:number`: Get a specific table

### Orders
- `POST /orders`: Create a new order
- `GET /orders`: Get all orders (with optional query param `?status=Pending`)
- `GET /orders/:id`: Get a specific order
- `PATCH /orders/:id`: Update order status/assignment
- `DELETE /orders/:id`: Delete an order

## Order Status Workflow

1. **Creating an Order**:
   - When an order is created, its initial status is set to "Pending"
   - The table status is updated to "Occupied"
   - A notification is sent to all connected clients via WebSocket

2. **Taking an Order**:
   - Chef assigns themselves to an order from the Kitchen interface
   - Order status is updated to "In Progress"
   - A notification is sent about the status change

3. **Completing an Order**:
   - Chef marks the order as "Ready" when food is prepared
   - Status is updated in the database
   - A notification is sent

4. **Serving an Order**:
   - Staff marks the order as "Completed" when served
   - The table status is updated to "Available"
   - A notification is sent

## Frontend Pages

### Kitchen Monitor
- Displays all orders with status filters
- Allows assigning chefs to orders
- Provides table filtering
- Shows order details and preparation times

### Chef Station
- Personalized view for each chef
- Shows only the chef's assigned orders and pending orders
- Estimates preparation times based on items
- Provides dedicated workflow for cooking processes

## SQL Queries for Monitoring

### Menu Items
```sql
SELECT * FROM menu_items ORDER BY category, name;
```

### Active Orders
```sql
SELECT o.id, o.table_number, o.status, o.assigned_to, o.order_time, 
       (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - o.order_time)) / 60)::INTEGER AS wait_time_mins 
FROM orders o 
WHERE o.status IN ('Pending', 'In Progress') 
ORDER BY o.order_time;
```

### Orders by Chef
```sql
SELECT assigned_to, COUNT(*) as order_count 
FROM orders 
WHERE status = 'In Progress' 
GROUP BY assigned_to;
```

### Table Status
```sql
SELECT number, status, capacity FROM tables ORDER BY number;
```

### Recent Notifications
```sql
SELECT * FROM notifications ORDER BY timestamp DESC LIMIT 10;
```

## Troubleshooting

### Cannot Connect to Database
- Ensure PostgreSQL container is running: `docker ps | grep postgres`
- Check database connection: `docker exec -it postgres psql -U postgres -d bistro92 -c "SELECT 'Connection successful'"`

### WebSocket Connection Issues
- Ensure the notification service is running
- Check browser console for WebSocket errors
- Verify RabbitMQ connection: `docker exec -it rabbitmq rabbitmqctl list_queues`

### Order Status Not Updating
- Check order service logs for errors
- Verify the Temporal service is running: `docker ps | grep temporal`
- Test API endpoint manually: `curl -X PATCH http://localhost:8000/orders/1 -H "Content-Type: application/json" -d '{"status":"In Progress"}'` 
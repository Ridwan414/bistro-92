-- Drop existing tables if they exist (for clean reinstallation)
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS tables;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS notifications;

-- Menu items table
CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50),
    prep_time INT DEFAULT 5, -- Estimated preparation time in minutes
    image_url VARCHAR(255)
);

-- Tables table
CREATE TABLE tables (
    id SERIAL PRIMARY KEY,
    number INT UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'Available',
    capacity INT DEFAULT 4
);

-- Orders table with status tracking
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    table_number INT NOT NULL REFERENCES tables(number),
    items JSONB NOT NULL,
    order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Pending',
    assigned_to VARCHAR(100) DEFAULT NULL, -- Kept for backward compatibility but not used
    completed_time TIMESTAMP,  -- When the order was completed
    notes TEXT,                -- Special instructions
    total_amount DECIMAL(10, 2) -- Total order amount
);

-- Notifications table to track sent notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(id),
    notification_type VARCHAR(50) NOT NULL, -- 'new_order', 'status_change', etc.
    message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'Sent'
);

-- Indexes
CREATE INDEX idx_orders_order_time ON orders (order_time);
CREATE INDEX idx_orders_table_number ON orders (table_number);
CREATE INDEX idx_orders_status ON orders (status);
CREATE INDEX idx_notifications_order_id ON notifications (order_id); 
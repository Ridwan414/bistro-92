-- Menu items with preparation times
INSERT INTO menu_items (id, name, price, category, prep_time, image_url) VALUES
(1, 'Pizza', 10.99, 'Main', 12, 'https://cdn.pixabay.com/photo/2017/12/09/08/18/pizza-3007395_1280.jpg'),
(2, 'Soda', 2.99, 'Drink', 1, 'https://cdn.pixabay.com/photo/2019/11/11/15/32/soda-4619140_1280.jpg'),
(3, 'Burger', 8.99, 'Main', 10, 'https://cdn.pixabay.com/photo/2016/03/05/19/02/hamburger-1238246_1280.jpg'),
(4, 'Fries', 3.99, 'Side', 5, 'https://cdn.pixabay.com/photo/2016/11/20/09/06/bowl-1842294_1280.jpg'),
(5, 'Salad', 6.99, 'Side', 4, 'https://cdn.pixabay.com/photo/2016/08/18/18/40/salad-1603608_1280.jpg'),
(6, 'Coffee', 2.49, 'Drink', 3, 'https://cdn.pixabay.com/photo/2016/11/29/12/45/beverage-1869598_1280.jpg'),
(7, 'Pasta', 11.99, 'Main', 15, 'https://cdn.pixabay.com/photo/2018/07/18/19/12/pasta-3547078_1280.jpg'),
(8, 'Ice Cream', 4.99, 'Dessert', 2, 'https://cdn.pixabay.com/photo/2016/03/23/15/00/ice-cream-1274894_1280.jpg');

-- Reset sequence to ensure next ID is correct
SELECT setval('menu_items_id_seq', (SELECT MAX(id) FROM menu_items));

-- Create some tables
INSERT INTO tables (number, status, capacity) VALUES
(1, 'Available', 2),
(2, 'Available', 4),
(3, 'Available', 4),
(4, 'Available', 6),
(5, 'Available', 8),
(10, 'Available', 2),
(11, 'Available', 2),
(12, 'Available', 4);

-- Sample order 1 - Pending
INSERT INTO orders (table_number, items, status, total_amount) VALUES
(3, '[
  {"ItemID": 1, "Name": "Pizza", "Price": 10.99, "Quantity": 1},
  {"ItemID": 2, "Name": "Soda", "Price": 2.99, "Quantity": 2}
]'::jsonb, 'Pending', 16.97);

-- Sample order 2 - In Progress
INSERT INTO orders (table_number, items, status, total_amount) VALUES
(5, '[
  {"ItemID": 3, "Name": "Burger", "Price": 8.99, "Quantity": 1},
  {"ItemID": 4, "Name": "Fries", "Price": 3.99, "Quantity": 1},
  {"ItemID": 2, "Name": "Soda", "Price": 2.99, "Quantity": 1}
]'::jsonb, 'In Progress', 15.97);

-- Sample order 3 - Ready to serve
INSERT INTO orders (table_number, items, status, total_amount) VALUES
(2, '[
  {"ItemID": 7, "Name": "Pasta", "Price": 11.99, "Quantity": 2},
  {"ItemID": 5, "Name": "Salad", "Price": 6.99, "Quantity": 1}
]'::jsonb, 'Ready', 30.97);

-- Sample notifications
INSERT INTO notifications (order_id, notification_type, message) VALUES
(1, 'new_order', 'New order received for table 3'),
(2, 'status_change', 'Order for table 5 is now In Progress'),
(3, 'status_change', 'Order for table 2 is now Ready to serve'); 
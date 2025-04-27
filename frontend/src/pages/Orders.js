import React, { useState, useEffect } from 'react';
import axios from 'axios';
import OrderNotifications from '../components/OrderNotifications';
import { useWebSocket } from '../WebSocketContext';

function Orders() {
  const [menuItems, setMenuItems] = useState([]);
  const [tableNumber, setTableNumber] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderError, setOrderError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { connected } = useWebSocket();

  // Load menu items on component mount
  useEffect(() => {
    const fetchMenuItems = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get('http://localhost:8000/menu-items');
        if (response.data && Array.isArray(response.data)) {
          setMenuItems(response.data);
        } else {
          // Fallback to demo items if API fails
          setMenuItems([
            { id: 1, name: 'Pizza', price: 10.99, category: 'Main' },
            { id: 2, name: 'Soda', price: 2.99, category: 'Drink' },
            { id: 3, name: 'Burger', price: 8.99, category: 'Main' },
            { id: 4, name: 'Fries', price: 3.99, category: 'Side' },
            { id: 5, name: 'Salad', price: 6.99, category: 'Side' },
            { id: 6, name: 'Coffee', price: 2.49, category: 'Drink' },
            { id: 7, name: 'Pasta', price: 11.99, category: 'Main' },
            { id: 8, name: 'Ice Cream', price: 4.99, category: 'Dessert' }
          ]);
        }
      } catch (error) {
        console.error('Error fetching menu items:', error);
        // Fallback to demo items if API fails
        setMenuItems([
          { id: 1, name: 'Pizza', price: 10.99, category: 'Main' },
          { id: 2, name: 'Soda', price: 2.99, category: 'Drink' },
          { id: 3, name: 'Burger', price: 8.99, category: 'Main' },
          { id: 4, name: 'Fries', price: 3.99, category: 'Side' },
          { id: 5, name: 'Salad', price: 6.99, category: 'Side' },
          { id: 6, name: 'Coffee', price: 2.49, category: 'Drink' },
          { id: 7, name: 'Pasta', price: 11.99, category: 'Main' },
          { id: 8, name: 'Ice Cream', price: 4.99, category: 'Dessert' }
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMenuItems();
  }, []);

  const handleAddItem = (item) => {
    const existingItem = selectedItems.find(i => i.ItemID === item.id);
    
    if (existingItem) {
      // Update quantity if item already exists
      setSelectedItems(selectedItems.map(i => 
        i.ItemID === item.id 
          ? { ...i, Quantity: i.Quantity + 1 } 
          : i
      ));
    } else {
      // Add new item with quantity 1
      setSelectedItems([
        ...selectedItems,
        { 
          ItemID: item.id,
          Name: item.name, 
          Price: parseFloat(item.price), 
          Quantity: 1 
        }
      ]);
    }
  };

  const handleRemoveItem = (itemId) => {
    setSelectedItems(selectedItems.filter(item => item.ItemID !== itemId));
  };

  const updateQuantity = (itemId, quantity) => {
    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity < 1) return;

    setSelectedItems(selectedItems.map(item => 
      item.ItemID === itemId ? { ...item, Quantity: parsedQuantity } : item
    ));
  };

  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => total + (item.Price * item.Quantity), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset status
    setOrderSuccess(false);
    setOrderError(null);
    
    // Validate
    if (!tableNumber || selectedItems.length === 0) {
      setOrderError('Please enter a table number and select at least one item.');
      return;
    }

    // Prepare order data
    const orderData = {
      TableNumber: parseInt(tableNumber),
      Items: selectedItems.map(item => ({
        ItemID: item.ItemID,
        Name: item.Name,
        Quantity: item.Quantity,
        Price: item.Price
      }))
    };

    try {
      setIsSubmitting(true);
      // Send to order service
      const response = await axios.post('http://localhost:8000/orders', orderData);
      console.log('Order created:', response.data);
      
      // Success
      setOrderSuccess(true);
      setTableNumber('');
      setSelectedItems([]);
      
      // Reset success message after 3 seconds
      setTimeout(() => setOrderSuccess(false), 3000);
    } catch (error) {
      console.error('Error creating order:', error);
      setOrderError('Failed to create order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Create Order</h1>
        <span className={`badge ${connected ? 'bg-success' : 'bg-danger'}`}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      {orderSuccess && (
        <div className="alert alert-success" role="alert">
          Order placed successfully!
        </div>
      )}
      
      {orderError && (
        <div className="alert alert-danger" role="alert">
          {orderError}
        </div>
      )}
      
      <div className="row">
        {/* Menu Items */}
        <div className="col-md-8">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Menu Items</h5>
            </div>
            <div className="card-body">
              {isLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Loading menu items...</p>
                </div>
              ) : (
                <div className="row">
                  {menuItems.map(item => (
                    <div key={item.id} className="col-md-4 mb-3">
                      <div className="card order-card h-100">
                        <div className="card-body">
                          <h5 className="card-title">{item.name}</h5>
                          <p className="card-text text-muted">{item.category}</p>
                          <p className="card-text text-primary fw-bold">${parseFloat(item.price).toFixed(2)}</p>
                          <button 
                            className="btn btn-outline-primary w-100"
                            onClick={() => handleAddItem(item)}
                          >
                            Add to Order
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Order Form */}
        <div className="col-md-4">
          <div className="card mb-4">
            <div className="card-header">
              <h5 className="mb-0">Current Order</h5>
            </div>
            <div className="card-body">
              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="tableNumber" className="form-label">Table Number</label>
                  <input
                    type="number"
                    className="form-control"
                    id="tableNumber"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    required
                  />
                </div>
                
                <h6>Selected Items:</h6>
                {selectedItems.length === 0 ? (
                  <p className="text-muted">No items selected</p>
                ) : (
                  <ul className="list-group mb-3">
                    {selectedItems.map(item => (
                      <li key={item.ItemID} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{item.Name}</strong> - ${item.Price.toFixed(2)}
                          <div className="input-group input-group-sm mt-1" style={{ width: '100px' }}>
                            <span className="input-group-text">Qty</span>
                            <input
                              type="number"
                              className="form-control"
                              value={item.Quantity}
                              min="1"
                              onChange={(e) => updateQuantity(item.ItemID, e.target.value)}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleRemoveItem(item.ItemID)}
                        >
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                
                <div className="d-flex justify-content-between mb-3">
                  <h5>Total:</h5>
                  <h5>${calculateTotal().toFixed(2)}</h5>
                </div>
                
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={isSubmitting || selectedItems.length === 0}
                >
                  {isSubmitting ? 'Placing Order...' : 'Place Order'}
                </button>
              </form>
            </div>
          </div>
          
          {/* Add OrderNotifications component below the order form */}
          <OrderNotifications />
        </div>
      </div>
    </div>
  );
}

export default Orders;
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import OrderNotifications from '../components/OrderNotifications';
import { useWebSocket } from '../WebSocketContext';

// Status constants for clarity
const ORDER_STATUS = {
  PENDING: 'Pending',
  IN_PROGRESS: 'In Progress',
  READY: 'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

function Kitchen() {
  const [orders, setOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState('all');
  const [tables, setTables] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { connected, notifications } = useWebSocket();

  useEffect(() => {
    // Fetch existing orders whenever a new notification comes in
    fetchOrders();
    
    // Set up polling to refresh orders every 30 seconds as a backup
    const intervalId = setInterval(fetchOrders, 30000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [notifications]); // Add notifications as a dependency

  // Fetch orders from API
  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/orders');
      if (response.data && Array.isArray(response.data)) {
        // Transform API data to our orders format - updated to match the actual API response format
        const apiOrders = response.data.map(order => ({
          id: order.ID,
          tableNumber: order.TableNumber,
          items: Array.isArray(order.Items) ? order.Items : [],
          timestamp: order.OrderTime || new Date().toISOString(),
          status: order.Status || ORDER_STATUS.PENDING,
        }));
        
        setOrders(apiOrders);
        
        // Update tables list
        const tableNumbers = [...new Set(apiOrders.map(order => order.tableNumber))];
        setTables(tableNumbers.sort((a, b) => a - b));
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to update tables list
  const updateTablesList = (tableNumber) => {
    setTables(prevTables => {
      if (!prevTables.includes(tableNumber)) {
        return [...prevTables, tableNumber].sort((a, b) => a - b);
      }
      return prevTables;
    });
  };

  // Handle order status change
  const changeOrderStatus = async (orderId, newStatus) => {
    try {
      // Update local state first for immediate feedback
      setOrders(prevOrders => 
        prevOrders.map(order => 
          order.id === orderId 
            ? { ...order, status: newStatus } 
            : order
        )
      );
      
      // Update in the API
      await axios.patch(`http://localhost:8000/orders/${orderId}`, {
        status: newStatus
      });
      
      // No need to update state again - already updated above
      // If the API call fails, we'll show an error but the UI won't flicker
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status. Please try again.');
      
      // Revert the local state change since the API call failed
      fetchOrders();
    }
  };

  // Filtered orders based on selected table
  const filteredOrders = selectedTable === 'all' 
    ? orders 
    : orders.filter(order => order.tableNumber === parseInt(selectedTable));

  // Sort orders: Pending first, then In Progress, then Ready, then Completed
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    const statusOrder = {
      [ORDER_STATUS.PENDING]: 0,
      [ORDER_STATUS.IN_PROGRESS]: 1,
      [ORDER_STATUS.READY]: 2,
      [ORDER_STATUS.COMPLETED]: 3,
      [ORDER_STATUS.CANCELLED]: 4
    };
    
    const orderA = statusOrder[a.status] !== undefined ? statusOrder[a.status] : 999;
    const orderB = statusOrder[b.status] !== undefined ? statusOrder[b.status] : 999;
    
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    
    // If status is the same, sort by timestamp (newest first)
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  const getStatusBadgeClass = (status) => {
    const statusMap = {
      [ORDER_STATUS.PENDING]: 'bg-warning',
      [ORDER_STATUS.IN_PROGRESS]: 'bg-primary',
      [ORDER_STATUS.READY]: 'bg-success',
      [ORDER_STATUS.COMPLETED]: 'bg-secondary',
      [ORDER_STATUS.CANCELLED]: 'bg-danger'
    };
    
    return statusMap[status] || 'bg-secondary';
  };

  const getPreparationTime = (timestamp) => {
    const orderTime = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - orderTime) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes === 1) {
      return '1 minute ago';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else {
      const hours = Math.floor(diffInMinutes / 60);
      const remainingMinutes = diffInMinutes % 60;
      
      if (hours === 1) {
        if (remainingMinutes === 0) {
          return '1 hour ago';
        } else if (remainingMinutes === 1) {
          return '1 hour, 1 minute ago';
        } else {
          return `1 hour, ${remainingMinutes} minutes ago`;
        }
      } else {
        if (remainingMinutes === 0) {
          return `${hours} hours ago`;
        } else if (remainingMinutes === 1) {
          return `${hours} hours, 1 minute ago`;
        } else {
          return `${hours} hours, ${remainingMinutes} minutes ago`;
        }
      }
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Kitchen Monitor</h1>
        <div className="d-flex align-items-center">
          <span className={`badge ${connected ? 'bg-success' : 'bg-danger'} me-2`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <button 
            className="btn btn-primary"
            onClick={fetchOrders}
          >
            Refresh Orders
          </button>
        </div>
      </div>

      <div className="row mb-4">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Order Queue</h5>
              <div>
                <label className="me-2">Filter by Table:</label>
                <select 
                  className="form-select form-select-sm d-inline-block w-auto"
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                >
                  <option value="all">All Tables</option>
                  {tables.map(table => (
                    <option key={table} value={table}>Table {table}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="card-body">
              {isLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-3">Loading orders...</p>
                </div>
              ) : sortedOrders.length > 0 ? (
                <div className="row">
                  {sortedOrders.map(order => (
                    <div key={order.id} className="col-md-6 mb-4">
                      <div className="card h-100">
                        <div className="card-header d-flex justify-content-between align-items-center">
                          <h5 className="mb-0">Table {order.tableNumber}</h5>
                          <div>
                            <span className={`badge ${getStatusBadgeClass(order.status)} me-2`}>
                              {order.status}
                            </span>
                            <span className="text-muted">
                              {getPreparationTime(order.timestamp)}
                            </span>
                          </div>
                        </div>
                        <div className="card-body">
                          <h6>Items:</h6>
                          <ul className="list-group mb-3">
                            {order.items.map((item, index) => (
                              <li key={index} className="list-group-item d-flex justify-content-between align-items-center">
                                <span>{item.Name}</span>
                                <span className="badge bg-primary rounded-pill">x{item.Quantity}</span>
                              </li>
                            ))}
                          </ul>
                          
                          <div className="d-flex flex-wrap justify-content-between">
                            {order.status === ORDER_STATUS.PENDING && (
                              <button 
                                className="btn btn-primary btn-sm mb-2"
                                onClick={() => changeOrderStatus(order.id, ORDER_STATUS.IN_PROGRESS)}
                              >
                                Start Preparation
                              </button>
                            )}
                            
                            {order.status === ORDER_STATUS.IN_PROGRESS && (
                              <button 
                                className="btn btn-success btn-sm mb-2"
                                onClick={() => changeOrderStatus(order.id, ORDER_STATUS.READY)}
                              >
                                Mark as Ready
                              </button>
                            )}
                            
                            {order.status === ORDER_STATUS.READY && (
                              <button 
                                className="btn btn-secondary btn-sm mb-2"
                                onClick={() => changeOrderStatus(order.id, ORDER_STATUS.COMPLETED)}
                              >
                                Complete Order
                              </button>
                            )}
                            
                            {(order.status === ORDER_STATUS.PENDING || order.status === ORDER_STATUS.IN_PROGRESS) && (
                              <button 
                                className="btn btn-danger btn-sm mb-2"
                                onClick={() => changeOrderStatus(order.id, ORDER_STATUS.CANCELLED)}
                              >
                                Cancel Order
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5">
                  <p className="text-muted">No orders to display.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <OrderNotifications />
        </div>
      </div>
    </div>
  );
}

export default Kitchen; 
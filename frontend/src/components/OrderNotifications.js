import React, { useMemo, useState } from 'react';
import { useWebSocket } from '../WebSocketContext';

const OrderNotifications = ({ maxHeight = '500px' }) => {
  const { connected, notifications, clearNotifications } = useWebSocket();
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showAll, setShowAll] = useState(false);

  // Deduplicate notifications based on ID and limit to 10 visible by default
  const uniqueNotifications = useMemo(() => {
    // Create a Map with notification ID as key to automatically handle duplicates
    const notificationsMap = new Map();
    
    notifications.forEach(notification => {
      if (notification.id && !notificationsMap.has(notification.id)) {
        notificationsMap.set(notification.id, notification);
      }
    });
    
    // Convert Map values back to array and sort by timestamp (newest first)
    return Array.from(notificationsMap.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [notifications]);

  const visibleNotifications = showAll 
    ? uniqueNotifications 
    : uniqueNotifications.slice(0, 10);

  // Handle notification click
  const handleNotificationClick = (notification) => {
    setSelectedNotification(notification);
  };

  // Handle clear notifications
  const handleClearNotifications = () => {
    if (window.confirm('Are you sure you want to clear all notification history?')) {
      clearNotifications();
      setSelectedNotification(null);
    }
  };

  // Return early if not connected and no notifications
  if (!connected && notifications.length === 0) {
    return (
      <div className="order-notification-panel card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Recent Orders</h5>
          <span className="badge bg-danger">Disconnected</span>
        </div>
        <div className="card-body text-center py-4">
          <p className="text-muted">Not connected to notification service</p>
        </div>
      </div>
    );
  }

  // If connected but no notifications
  if (notifications.length === 0) {
    return (
      <div className="order-notification-panel card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Recent Orders</h5>
          <span className={`badge ${connected ? 'bg-success' : 'bg-danger'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="card-body text-center py-4">
          <p className="text-muted">No notifications yet. Waiting for new orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="order-notification-panel card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">Recent Orders</h5>
        <div>
          <span className={`badge ${connected ? 'bg-success' : 'bg-danger'} me-2`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="badge bg-secondary">{uniqueNotifications.length}</span>
        </div>
      </div>
      
      {/* Notification list */}
      <div className="card-body p-0" style={{ maxHeight, overflowY: 'auto' }}>
        <ul className="list-group list-group-flush">
          {visibleNotifications.map((notification) => (
            <li 
              key={notification.id} 
              className={`list-group-item list-group-item-action ${selectedNotification?.id === notification.id ? 'active' : ''}`}
              onClick={() => handleNotificationClick(notification)}
              style={{ cursor: 'pointer' }}
            >
              <div className="d-flex justify-content-between">
                <div>
                  <h6 className="mb-1">
                    {notification.type === 'new_order' ? 'New Order' : 'Status Change'}
                  </h6>
                  <p className="mb-1">
                    Table {notification.table_number}
                    {notification.status && ` - ${notification.status}`}
                  </p>
                </div>
                <small className={`${selectedNotification?.id === notification.id ? 'text-white' : 'text-muted'}`}>
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </small>
              </div>
            </li>
          ))}
        </ul>
      </div>
      
      {/* Footer controls */}
      <div className="card-footer d-flex justify-content-between">
        <button 
          type="button" 
          className="btn btn-sm btn-outline-danger"
          onClick={handleClearNotifications}
        >
          Clear All
        </button>
        
        {uniqueNotifications.length > 10 && (
          <button 
            type="button" 
            className="btn btn-sm btn-outline-primary"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : `Show All (${uniqueNotifications.length})`}
          </button>
        )}
      </div>
      
      {/* Detail panel for selected notification */}
      {selectedNotification && (
        <div className="card mt-3">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Notification Details</h5>
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setSelectedNotification(null)}
            />
          </div>
          <div className="card-body">
            <h6>Type: {selectedNotification.type}</h6>
            <p>Table: {selectedNotification.table_number}</p>
            <p>Time: {new Date(selectedNotification.timestamp).toLocaleString()}</p>
            {selectedNotification.status && <p>Status: {selectedNotification.status}</p>}
            {selectedNotification.message && <p>Message: {selectedNotification.message}</p>}
            
            {selectedNotification.items && selectedNotification.items.length > 0 && (
              <>
                <h6 className="mt-3">Order Items:</h6>
                <ul className="list-group">
                  {selectedNotification.items.map((item, index) => (
                    <li key={index} className="list-group-item d-flex justify-content-between">
                      <span>{item.Name}</span>
                      <span>
                        {item.Quantity} × ${parseFloat(item.Price).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <div className="mt-3 text-end">
                  <strong>Total: ${selectedNotification.items.reduce(
                    (total, item) => total + (item.Price * item.Quantity), 0
                  ).toFixed(2)}</strong>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderNotifications; 
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';

// Create WebSocket context
const WebSocketContext = createContext();

// Socket connection URL - will connect to notification service
const SOCKET_URL = 'ws://localhost:3001/ws?room=orders';

// Maximum number of notifications to store
const MAX_STORED_NOTIFICATIONS = 50;

// Key for storing notifications in localStorage
const NOTIFICATIONS_STORAGE_KEY = 'bistro92_notifications';

export const WebSocketProvider = ({ children }) => {
  // Get stored notifications from localStorage on initial load
  const getStoredNotifications = () => {
    try {
      const storedNotifications = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      return storedNotifications ? JSON.parse(storedNotifications) : [];
    } catch (error) {
      console.error('Error retrieving stored notifications:', error);
      return [];
    }
  };

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState(getStoredNotifications);
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  
  // Track processed notification IDs to prevent duplicates
  const processedNotificationsRef = useRef(new Set());

  // Save notifications to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error('Error saving notifications to storage:', error);
    }
  }, [notifications]);

  // Initialize WebSocket connection
  useEffect(() => {
    // Populate the processed notifications set from existing notifications
    processedNotificationsRef.current = new Set(
      notifications.map(notification => notification.id)
    );

    // Function to establish connection
    const connectWebSocket = () => {
      // Clear any existing reconnection timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      // If we already have a socket, don't create another one
      if (socketRef.current) {
        return;
      }
      
      console.log('Connecting to WebSocket...');
      const ws = new WebSocket(SOCKET_URL);
      socketRef.current = ws;
      
      ws.onopen = () => {
        console.log('WebSocket connection established');
        setSocket(ws);
        setConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const notification = JSON.parse(event.data);
          console.log('New WebSocket notification received:', notification);
          
          // Skip connection_established messages from the notifications list
          if (notification.type === 'connection_established') {
            return;
          }
          
          // Check if we've already processed this notification
          if (notification.id && processedNotificationsRef.current.has(notification.id)) {
            console.log('Duplicate notification detected and skipped. ID:', notification.id);
            return;
          }
          
          // Mark notification as processed
          if (notification.id) {
            processedNotificationsRef.current.add(notification.id);
            console.log('Added notification ID to processed set:', notification.id);
            console.log('Processed notifications count:', processedNotificationsRef.current.size);
            
            // Limit the size of the processed set to avoid memory leaks
            if (processedNotificationsRef.current.size > MAX_STORED_NOTIFICATIONS * 2) {
              // Remove the oldest notifications (convert to array, slice, and back to set)
              const notificationArray = Array.from(processedNotificationsRef.current);
              processedNotificationsRef.current = new Set(notificationArray.slice(-MAX_STORED_NOTIFICATIONS));
              console.log('Trimmed processed notifications set to 50 items');
            }
          }
          
          // Add to notifications list and preserve in state
          setNotifications(prev => {
            // Prevent duplicate notifications based on ID
            const isDuplicate = prev.some(n => n.id === notification.id);
            if (isDuplicate) {
              return prev;
            }
            
            // Add new notification to the beginning and limit total count
            const updatedNotifications = [notification, ...prev].slice(0, MAX_STORED_NOTIFICATIONS);
            return updatedNotifications;
          });
          
          // Show toast notification for new orders only
          if (notification.type === 'new_order') {
            toast.info(`New order from Table ${notification.table_number}`, {
              position: "top-right",
              autoClose: 5000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              toastId: notification.id, // Prevent duplicate toasts
            });
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      ws.onclose = (e) => {
        console.log(`WebSocket connection closed: ${e.code} ${e.reason}`);
        setConnected(false);
        socketRef.current = null;
        
        // Attempt to reconnect after a delay
        reconnectTimerRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connectWebSocket();
        }, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // The close handler will handle reconnection
      };
    };
    
    connectWebSocket();
    
    // Clean up on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [notifications]);
  
  // Function to clear notification history
  const clearNotifications = () => {
    setNotifications([]);
    localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
    processedNotificationsRef.current.clear();
  };
  
  return (
    <WebSocketContext.Provider value={{ 
      socket, 
      connected, 
      notifications,
      clearNotifications 
    }}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook to use WebSocket context
export const useWebSocket = () => useContext(WebSocketContext);
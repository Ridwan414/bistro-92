import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import OrderNotifications from '../components/OrderNotifications';
import { useWebSocket } from '../WebSocketContext';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

function Dashboard() {
  const [metrics, setMetrics] = useState({ 
    pending_orders: 0, 
    total_sales: 0,
    order_stats: { completed: 0, pending: 0, canceled: 0 },
    popular_items: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { notifications, connected } = useWebSocket();
  
  // Create a memoized function to fetch metrics
  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      // Use the dashboard service endpoint
      const response = await axios.get('http://localhost:5000/dashboard/metrics');
      setMetrics(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching metrics:', err);
      setError('Failed to load dashboard metrics. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch metrics initially and when notifications are updated
  useEffect(() => {
    fetchMetrics();
    
    // Poll every 30 seconds as a fallback
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics, notifications]); // Refetch when new notifications arrive

  // Chart data for order status
  const orderStatusData = {
    labels: ['Completed', 'Pending', 'Canceled'],
    datasets: [
      {
        data: [
          metrics.order_stats?.completed || 0, 
          metrics.order_stats?.pending || 0, 
          metrics.order_stats?.canceled || 0
        ],
        backgroundColor: ['#4caf50', '#ff9800', '#f44336'],
        hoverBackgroundColor: ['#388e3c', '#f57c00', '#d32f2f'],
      },
    ],
  };

  // Chart data for popular items
  const popularItemsData = {
    labels: metrics.popular_items?.map(item => item.name) || [],
    datasets: [
      {
        label: 'Order Count',
        data: metrics.popular_items?.map(item => item.count) || [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '70vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Restaurant Dashboard</h1>
        <div className="d-flex align-items-center">
          <span className={`badge ${connected ? 'bg-success' : 'bg-danger'} me-2`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <button 
            className="btn btn-primary btn-sm"
            onClick={fetchMetrics}
          >
            Refresh Data
          </button>
        </div>
      </div>
      
      {error && (
        <div className="alert alert-warning" role="alert">
          {error}
        </div>
      )}
      
      <div className="row mb-4">
        <div className="col-md-8">
          <div className="row">
            <div className="col-md-6">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Pending Orders</h5>
                  <h2 className="display-4 text-warning">{metrics.pending_orders}</h2>
                </div>
              </div>
            </div>
            <div className="col-md-6">
              <div className="card">
                <div className="card-body">
                  <h5 className="card-title">Total Sales</h5>
                  <h2 className="display-4 text-success">${metrics.total_sales.toFixed(2)}</h2>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <OrderNotifications maxHeight="400px" />
        </div>
      </div>

      <div className="row">
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Order Status</h5>
              <div style={{ height: '300px' }}>
                {orderStatusData.datasets[0].data.some(value => value > 0) ? (
                  <Pie data={orderStatusData} options={{ maintainAspectRatio: false }} />
                ) : (
                  <div className="text-center h-100 d-flex flex-column justify-content-center">
                    <p className="text-muted">No order data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6 mb-4">
          <div className="card">
            <div className="card-body">
              <h5 className="card-title">Popular Items</h5>
              <div style={{ height: '300px' }}>
                {metrics.popular_items && metrics.popular_items.length > 0 ? (
                  <Bar 
                    data={popularItemsData} 
                    options={{ 
                      maintainAspectRatio: false,
                      scales: {
                        y: {
                          beginAtZero: true
                        }
                      }
                    }} 
                  />
                ) : (
                  <div className="text-center h-100 d-flex flex-column justify-content-center">
                    <p className="text-muted">No item data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard; 
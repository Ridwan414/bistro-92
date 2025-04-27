import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import { WebSocketProvider } from './WebSocketContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  return (
    <WebSocketProvider>
      <div className="container-fluid">
        <div className="row">
          {/* Sidebar */}
          <div className="col-md-2 sidebar p-0">
            <div className="d-flex flex-column p-3">
              <h2 className="mb-4 text-center">Bistro 92</h2>
              <ul className="nav nav-pills flex-column mb-auto">
                <li className="nav-item mb-2">
                  <NavLink to="/" className={({ isActive }) => 
                    isActive ? "nav-link active" : "nav-link"
                  }>
                    Dashboard
                  </NavLink>
                </li>
                <li className="nav-item mb-2">
                  <NavLink to="/orders" className={({ isActive }) => 
                    isActive ? "nav-link active" : "nav-link"
                  }>
                    Orders
                  </NavLink>
                </li>
                <li className="nav-item mb-2">
                  <NavLink to="/kitchen" className={({ isActive }) => 
                    isActive ? "nav-link active" : "nav-link"
                  }>
                    Kitchen Monitor
                  </NavLink>
                </li>
              </ul>
            </div>
          </div>

          {/* Main Content */}
          <div className="col-md-10 main-content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/kitchen" element={<Kitchen />} />
            </Routes>
          </div>
        </div>
      </div>
      <ToastContainer />
    </WebSocketProvider>
  );
}

export default App; 
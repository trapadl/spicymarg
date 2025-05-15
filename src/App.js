import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import pages
import LandingPage from './pages/LandingPage';
import VoucherPage from './pages/VoucherPage';
import ConfirmPage from './pages/ConfirmPage';
import AdminPage from './pages/AdminPage';

// Import CSS
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/voucher" element={<VoucherPage />} />
          <Route path="/confirm/:token" element={<ConfirmPage />} />
          <Route path="/admin" element={<AdminPage />} />
          {/* Redirect to landing page for any other route */}
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
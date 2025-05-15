import React, { useState, useEffect } from 'react';
// Removed: import bcrypt from 'bcryptjs'; // No longer needed for client-side comparison
import Layout from '../components/common/Layout'; // Assuming Layout is not used here directly based on your styling
import { supabase, getFunnelStats, getMonthlyMetrics, updateMonthlyMetrics, deleteMonthlyMetrics } from '../api/supabase';
import FunnelStatsComponent from '../components/admin/FunnelStats'; // Renamed to avoid conflict
import MetricsTable from '../components/admin/MetricsTable';
import MetricsForm from '../components/admin/MetricsForm';
import MetricsDashboard from '../components/admin/MetricsDashboard';
import './AdminPage.css';

// REMOVED: const ADMIN_HASH = "$2a$10$WHhsESNuNV.P3CeVpibxgePItr4KnuCnQvuZVWqiz9DEh5svIv2sq";
// The actual hash is now an environment variable in the Supabase Edge Function

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false); // For login button state
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const [funnelStatsData, setFunnelStatsData] = useState([]); // Renamed state variable
  const [metrics, setMetrics] = useState([]);
  const [showMetricsForm, setShowMetricsForm] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoadingData, setIsLoadingData] = useState(false); // For data loading state
  
  useEffect(() => {
    const adminSessionActive = sessionStorage.getItem('adminSessionActive');
    if (adminSessionActive === 'true') {
      setIsLoggedIn(true);
      loadDashboardData();
    }
  }, []);
  
  const loadDashboardData = async () => {
    setIsLoadingData(true);
    setError('');
    try {
      // Use the new RPC for funnel stats if you switched getFunnelStats in supabase.js
      // or ensure getFunnelStats() fetches from the new view or RPC.
      const statsResult = await getFunnelStats(); // This should now fetch from get_funnel_stats_data() or similar
      const metricsResult = await getMonthlyMetrics();
      
      setFunnelStatsData(statsResult || []);
      setMetrics(metricsResult || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load dashboard data. Please try refreshing.');
    } finally {
      setIsLoadingData(false);
    }
  };
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoggingIn(true);
    
    try {
      // Call the Supabase Edge Function to verify the admin password
      const { data, error: funcError } = await supabase.functions.invoke('verify-admin', {
        body: { accessCode: password },
      });

      if (funcError) {
        console.error('Edge Function invocation error:', funcError);
        setError(funcError.message || 'Error calling verification service.');
        setIsLoggingIn(false);
        return;
      }

      if (data && data.success) {
        sessionStorage.setItem('adminSessionActive', 'true');
        setIsLoggedIn(true);
        await loadDashboardData();
      } else {
        setError(data.message || 'Invalid password or access denied.');
      }
    } catch (err) {
      console.error('Error during login:', err);
      setError('An unexpected error occurred during login. Please try again.');
    } finally {
      setIsLoggingIn(false);
      setPassword(''); // Clear password field
    }
  };
  
  const handleLogout = () => {
    sessionStorage.removeItem('adminSessionActive');
    setIsLoggedIn(false);
    // Optionally clear other states
    setFunnelStatsData([]);
    setMetrics([]);
    setActiveTab('dashboard');
  };
  
  const handleAddOrUpdateMetrics = async (metricData) => {
    setError(''); setSuccessMessage('');
    try {
      const result = await updateMonthlyMetrics(metricData);
      if (!result.success) {
        setError(result.message || 'Failed to save metrics.');
        return false;
      }
      await loadDashboardData(); // Reload all data
      setShowMetricsForm(false);
      setSuccessMessage('Monthly metrics saved successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
      return true;
    } catch (err) {
      console.error('Error saving metrics:', err);
      setError('An unexpected error occurred while saving metrics.');
      return false;
    }
  };
  
  const handleDeleteMetric = async (month) => {
    setError(''); setSuccessMessage('');
    if (!window.confirm(`Are you sure you want to delete metrics for ${new Date(month + 'T00:00:00').toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}?`)) {
        return;
    }
    try {
      const result = await deleteMonthlyMetrics(month);
      if (!result.success) {
        setError(result.message || 'Failed to delete metrics.');
        return;
      }
      await loadDashboardData(); // Reload all data
      setSuccessMessage('Monthly metrics deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Error deleting metrics:', err);
      setError('An unexpected error occurred while deleting metrics.');
    }
  };
  
  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };
  
  if (!isLoggedIn) {
    return (
      <div className="admin-page-container"> {/* Use a more specific class if Layout is not used */}
        <div className="login-container">
          <h2 className="login-title">Spicy Margarita Funnel Dashboard</h2>
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
              <button onClick={() => setError('')} className="alert-dismiss">Dismiss</button>
            </div>
          )}
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="login-input"
              required
              autoFocus
            />
            <button 
              type="submit" 
              className="login-button"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        </div>
      </div>
    );
  }
  
  return (
    <div className="admin-container"> {/* Main container for the admin page */}
      <div className="admin-header">
        <h1 className="admin-title">Spicy Margarita Funnel Dashboard</h1>
        <div className="tab-navigation">
          {['dashboard', 'stats', 'table'].map(tabName => (
            <button
              key={tabName}
              className={`tab-button ${activeTab === tabName ? 'active' : ''}`}
              onClick={() => { setActiveTab(tabName); clearMessages(); }}
            >
              {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
            </button>
          ))}
          <button 
            onClick={handleLogout}
            className="logout-button"
          >
            Log Out
          </button>
        </div>
      </div>
      
      <div className="admin-content">
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
            <button onClick={() => setError('')} className="alert-dismiss">Dismiss</button>
          </div>
        )}
        {successMessage && (
          <div className="alert alert-success">
            <span>{successMessage}</span>
            <button onClick={() => setSuccessMessage('')} className="alert-dismiss">Dismiss</button>
          </div>
        )}
        
        {isLoadingData ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading dashboard data...</p>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <MetricsDashboard metrics={metrics} />
            )}
            {activeTab === 'stats' && (
              // Pass funnelStatsData to the renamed component
              <FunnelStatsComponent stats={funnelStatsData} /> 
            )}
            {activeTab === 'table' && (
              <div className="table-section">
                {!showMetricsForm && (
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 className="table-title" style={{ margin: 0 }}>Monthly Metrics Data</h3>
                        <button 
                            onClick={() => { setShowMetricsForm(true); clearMessages(); }}
                            className="add-month-button"
                        >
                            Add New Month
                        </button>
                    </div>
                )}
                {showMetricsForm ? (
                  <MetricsForm 
                    onSubmit={handleAddOrUpdateMetrics}
                    onCancel={() => { setShowMetricsForm(false); clearMessages(); }}
                    existingMetrics={metrics} // Pass existing metrics to check for duplicates
                  />
                ) : (
                  <MetricsTable 
                    metrics={metrics} 
                    onDeleteMetric={handleDeleteMetric}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
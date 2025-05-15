import React, { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import './FunnelStats.css'; // Import the new CSS

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const FunnelStats = ({ stats }) => {
  const [chartData, setChartData] = useState(null);
  
  useEffect(() => {
    if (stats && stats.length > 0) {
      // Create the data for the chart
      const labels = stats.map(stage => stage.stage_name);
      const data = stats.map(stage => stage.count);
      
      setChartData({
        labels: labels,
        datasets: [
          {
            label: 'Number of Users',
            data: data,
            backgroundColor: [
              'rgba(255, 0, 127, 0.9)',
              'rgba(255, 0, 127, 0.7)',
              'rgba(255, 0, 127, 0.5)',
              'rgba(255, 0, 127, 0.3)'
            ],
            borderColor: [
              'rgba(255, 0, 127, 1)',
            ],
            borderWidth: 1,
            borderRadius: 6,
            hoverBackgroundColor: 'rgba(255, 0, 127, 1)',
          }
        ]
      });
    }
  }, [stats]);

  // Calculate overall conversion rate from stage 0 to final stage
  const calculateOverallConversion = () => {
    if (!stats || stats.length === 0) return 0;
    
    const stage0 = stats.find(s => s.stage === 0);
    const finalStage = stats.find(s => s.stage === stats.length - 1);
    
    if (!stage0 || !finalStage || stage0.count === 0) {
      return 0;
    }
    
    return (finalStage.count / stage0.count * 100).toFixed(2);
  };
  
  if (!stats || stats.length === 0) {
    return (
      <div className="funnel-container">
        <p className="text-gray-400 text-center">No funnel data available yet</p>
      </div>
    );
  }
  
  const overallConversion = calculateOverallConversion();
  
  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Funnel Conversion',
        color: 'white',
        font: {
          size: 18,
          family: "'Playfair Display', serif",
          weight: '600'
        },
        padding: {
          bottom: 20
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        displayColors: false,
        padding: 12,
        callbacks: {
          afterLabel: function(context) {
            const index = context.dataIndex;
            return `Conversion rate: ${stats[index].conversion_rate || 0}%`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.8)'
        },
        title: {
          display: true,
          text: 'Number of Users',
          color: 'rgba(255, 255, 255, 0.8)',
          font: {
            size: 12,
            weight: '500'
          }
        }
      },
      x: {
        grid: {
          display: false,
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.8)',
        }
      }
    }
  };
  
  return (
    <div className="funnel-container">
      <div className="funnel-chart">
        {chartData && (
          <Bar 
            data={chartData}
            options={chartOptions}
          />
        )}
      </div>
      
      <div className="funnel-summary">
        <div className="summary-card">
          <h4 className="summary-title">Total Leads</h4>
          <div className="summary-value">{stats[0]?.count || 0}</div>
        </div>
        
        <div className="summary-card">
          <h4 className="summary-title">Overall Conversion</h4>
          <div className="summary-value">{overallConversion}%</div>
        </div>
        
        <div className="summary-card">
          <h4 className="summary-title">First Visit Rate</h4>
          <div className="summary-value">
            {stats.find(s => s.stage === 2)?.conversion_rate || 0}%
          </div>
        </div>
      </div>
      
      <div className="funnel-breakdown">
        <h4 className="breakdown-title">Funnel Breakdown</h4>
        <div className="stages-container">
          {stats.map((stage, index) => (
            <div key={stage.stage} className="stage-item">
              <div className="stage-header">
                <div className="stage-name">{stage.stage_name}</div>
                <div className="stage-count">{stage.count} users</div>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar" 
                  style={{ width: `${Math.max(5, (stage.count / stats[0].count) * 100)}%` }}
                ></div>
              </div>
              {index > 0 && (
                <div className="stage-conversion">
                  {stage.conversion_rate}% from previous stage
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FunnelStats;
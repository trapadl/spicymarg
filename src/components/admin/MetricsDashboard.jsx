import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend
} from 'chart.js';
import './MetricsDashboard.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const MetricsDashboard = ({ metrics }) => {
  const formatCurrency = (amount, hideZero = false) => {
    const val = parseFloat(amount);
    if (hideZero && val === 0 && amount !== null) return '-'; // Allow explicit nulls to be $0.00
    return `$${(val || 0).toFixed(2)}`;
  };
  const formatPercentage = (value) => `${(parseFloat(value) || 0).toFixed(2)}%`;
  const formatNumber = (num, hideZero = false) => {
    const val = parseFloat(num);
     if (hideZero && val === 0 && num !== null) return '-';
    return (val || 0).toLocaleString();
  };

  const sortedMetrics = [...metrics].sort((a, b) => new Date(a.month) - new Date(b.month));

  const monthlyChartData = sortedMetrics.map(m => {
    const adSpend = parseFloat(m.stage0_ad_spend || 0);
    const revenue = parseFloat(m.total_revenue_from_funnel_this_month || 0);
    const cogs1 = parseFloat(m.stage1_cogs || 0);
    const smsCost = parseFloat(m.stage1_sms_cost || 0); // Changed from stage2_sms_cost
    const cogs2 = parseFloat(m.stage2_cogs || 0); // Added
    const cogs3 = parseFloat(m.stage3_cogs || 0);
    const profit = revenue - adSpend - cogs1 - smsCost - cogs2 - cogs3;
    return {
      month: new Date(m.month + 'T00:00:00').toLocaleDateString('en-AU', { month: 'short', year: 'numeric' }),
      adSpend,
      revenue,
      profit,
      // For derived metrics per month if needed for tooltips or other charts
      ctr: (parseFloat(m.total_ad_clicks || 0) / parseFloat(m.total_ad_impressions || 1)) * 100,
      cpc: parseFloat(m.stage0_ad_spend || 0) / parseFloat(m.total_ad_clicks || 1),
      landingPageConv: (parseFloat(m.new_leads_generated_this_month || 0) / parseFloat(m.total_ad_clicks || 1)) * 100,
    };
  });

  const chartData = {
    labels: monthlyChartData.map(d => d.month),
    datasets: [
      {
        label: 'Funnel Revenue',
        data: monthlyChartData.map(d => d.revenue),
        borderColor: 'var(--revenue-color)', backgroundColor: 'rgba(69, 187, 255, 0.2)',
        tension: 0.3, borderWidth: 2, pointRadius: 4,
      },
      {
        label: 'Ad Spend',
        data: monthlyChartData.map(d => d.adSpend),
        borderColor: 'var(--ad-spend-color)', backgroundColor: 'rgba(255, 77, 109, 0.2)',
        tension: 0.3, borderWidth: 2, pointRadius: 4,
      },
      {
        label: 'Funnel Profit',
        data: monthlyChartData.map(d => d.profit),
        borderColor: 'var(--profit-color)', backgroundColor: 'rgba(66, 245, 179, 0.2)',
        tension: 0.3, borderWidth: 2, pointRadius: 4,
      }
    ]
  };

  const chartOptions = { /* ... your existing chartOptions ... */
    responsive: true, maintainAspectRatio: true,
        scales: {
            y: { beginAtZero: true, grid: { color: 'var(--chart-grid-color)' }, ticks: { color: 'var(--chart-text-color)', callback: (v) => formatCurrency(v) }, title: { display: true, text: 'Amount ($)', color: 'var(--chart-text-color)'}},
            x: { grid: { display: false }, ticks: { color: 'var(--chart-text-color)'}, title: { display: true, text: 'Month', color: 'var(--chart-text-color)'}}
        },
        plugins: {
            legend: { position: 'top', labels: { color: 'var(--chart-text-color)', usePointStyle: true, pointStyle: 'circle' }},
            title: { display: true, text: 'Monthly Financial Performance', color: 'white', font: { size: 18, family: "'Playfair Display', serif" }, padding: { bottom: 20 }},
            tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${formatCurrency(c.parsed.y)}`}}
        }
   };

  // Calculate aggregate totals and derived metrics
  const totals = metrics.reduce((acc, m) => {
    acc.impressions += parseFloat(m.total_ad_impressions || 0);
    acc.clicks += parseFloat(m.total_ad_clicks || 0);
    acc.adSpend += parseFloat(m.stage0_ad_spend || 0);
    acc.newLeads += parseFloat(m.new_leads_generated_this_month || 0);
    acc.vouchersClaimed += parseFloat(m.vouchers_claimed_this_month || 0);
    acc.firstVisits += parseFloat(m.first_visits_this_month || 0);
    acc.secondVisits += parseFloat(m.second_visits_this_month || 0);
    acc.thirdVisits += parseFloat(m.third_visits_this_month || 0);
    acc.cogs1 += parseFloat(m.stage1_cogs || 0);
    acc.smsCost += parseFloat(m.stage1_sms_cost || 0);
    acc.cogs2 += parseFloat(m.stage2_cogs || 0);
    acc.cogs3 += parseFloat(m.stage3_cogs || 0);
    acc.funnelRevenue += parseFloat(m.total_revenue_from_funnel_this_month || 0);
    return acc;
  }, { impressions: 0, clicks: 0, adSpend: 0, newLeads: 0, vouchersClaimed: 0, firstVisits: 0, secondVisits: 0, thirdVisits: 0, cogs1: 0, smsCost: 0, cogs2: 0, cogs3: 0, funnelRevenue: 0 });

  const totalCogs = totals.cogs1 + totals.smsCost + totals.cogs2 + totals.cogs3;
  const totalFunnelProfit = totals.funnelRevenue - totals.adSpend - totalCogs;

  const derived = {
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.adSpend / totals.clicks : 0,
    landingPageConvRate: totals.clicks > 0 ? (totals.newLeads / totals.clicks) * 100 : 0,
    cpl: totals.newLeads > 0 ? totals.adSpend / totals.newLeads : 0,
    leadToClaimRate: totals.newLeads > 0 ? (totals.vouchersClaimed / totals.newLeads) * 100 : 0,
    claimTo1stVisitRate: totals.vouchersClaimed > 0 ? (totals.firstVisits / totals.vouchersClaimed) * 100 : 0,
    firstTo2ndVisitRate: totals.firstVisits > 0 ? (totals.secondVisits / totals.firstVisits) * 100 : 0,
    secondTo3rdVisitRate: totals.secondVisits > 0 ? (totals.thirdVisits / totals.secondVisits) * 100 : 0,
    overallFunnelCompletionRate: totals.newLeads > 0 ? (totals.thirdVisits / totals.newLeads) * 100 : 0,
    cpa: totals.thirdVisits > 0 ? (totals.adSpend + totalCogs) / totals.thirdVisits : 0, // Cost per completed funnel
    avgRevenuePerLead: totals.newLeads > 0 ? totals.funnelRevenue / totals.newLeads : 0,
    profitMargin: totals.funnelRevenue > 0 ? (totalFunnelProfit / totals.funnelRevenue) * 100 : 0,
    roiOnAdSpend: totals.adSpend > 0 ? (totalFunnelProfit / totals.adSpend) * 100 : 0,
  };

  if (!metrics || metrics.length === 0) {
    return <div className="chart-container"><p className="text-gray-400 text-center">No monthly metrics data available yet.</p></div>;
  }

  return (
    <div className="dashboard-container">
      <div className="chart-container">
        <Line data={chartData} options={chartOptions} />
      </div>

      <div className="metrics-summary">
        <div className="metric-card metric-revenue"><h4 className="metric-title">Total Funnel Revenue</h4><div className="metric-value">{formatCurrency(totals.funnelRevenue)}</div></div>
        <div className="metric-card metric-ad-spend"><h4 className="metric-title">Total Ad Spend</h4><div className="metric-value">{formatCurrency(totals.adSpend)}</div></div>
        <div className="metric-card metric-cogs"><h4 className="metric-title">Total Funnel COGS</h4><div className="metric-value">{formatCurrency(totalCogs)}</div></div>
        <div className={`metric-card metric-profit ${totalFunnelProfit >= 0 ? '' : 'negative'}`}><h4 className="metric-title">Total Funnel Profit</h4><div className="metric-value">{formatCurrency(totalFunnelProfit)}</div></div>
      </div>

      <div className="roi-analysis"> {/* Using roi-analysis class for section styling */}
        <h3 className="roi-title">Key Performance Indicators (Overall)</h3>
        <div className="roi-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Adjusted grid for more items */}
          <div className="metric-card"><h4 className="metric-title">Ad Impressions</h4><div className="metric-value">{formatNumber(totals.impressions)}</div></div>
          <div className="metric-card"><h4 className="metric-title">Ad Clicks</h4><div className="metric-value">{formatNumber(totals.clicks)}</div></div>
          <div className="metric-card"><h4 className="metric-title">Click-Through Rate (CTR)</h4><div className="metric-value">{formatPercentage(derived.ctr)}</div></div>
          
          <div className="metric-card"><h4 className="metric-title">Cost Per Click (CPC)</h4><div className="metric-value">{formatCurrency(derived.cpc)}</div></div>
          <div className="metric-card"><h4 className="metric-title">Landing Page Conv. Rate</h4><div className="metric-value">{formatPercentage(derived.landingPageConvRate)}</div></div>
          <div className="metric-card"><h4 className="metric-title">Cost Per Lead (CPL)</h4><div className="metric-value">{formatCurrency(derived.cpl)}</div></div>

          <div className="metric-card"><h4 className="metric-title">Leads Generated</h4><div className="metric-value">{formatNumber(totals.newLeads)}</div></div>
          <div className="metric-card"><h4 className="metric-title">Vouchers Claimed</h4><div className="metric-value">{formatNumber(totals.vouchersClaimed)}</div></div>
          <div className="metric-card"><h4 className="metric-title">Funnel Completions (3rd Visits)</h4><div className="metric-value">{formatNumber(totals.thirdVisits)}</div></div>
          
          <div className="metric-card"><h4 className="metric-title">Overall Funnel Completion Rate</h4><div className="metric-value">{formatPercentage(derived.overallFunnelCompletionRate)}</div></div>
          <div className="metric-card"><h4 className="metric-title">Cost Per Acquisition (CPA - Funnel)</h4><div className="metric-value">{formatCurrency(derived.cpa)}</div></div>
          <div className="metric-card"><h4 className="metric-title">Avg. Revenue Per Lead</h4><div className="metric-value">{formatCurrency(derived.avgRevenuePerLead)}</div></div>
          
          <div className="metric-card"><h4 className="metric-title">Funnel Profit Margin</h4><div className="metric-value">{formatPercentage(derived.profitMargin)}</div></div>
          <div className="metric-card"><h4 className="metric-title">ROI on Ad Spend</h4><div className="metric-value highlight">{formatPercentage(derived.roiOnAdSpend)}</div></div>
        </div>
      </div>

      <div className="roi-analysis" style={{marginTop: '25px'}}>
        <h3 className="roi-title">Funnel Stage Conversion Rates (Overall)</h3>
         <div className="roi-grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="metric-card"><h4 className="metric-title">Lead to Voucher Claim Rate</h4><div className="metric-value">{formatPercentage(derived.leadToClaimRate)}</div></div>
            <div className="metric-card"><h4 className="metric-title">Claim to 1st Visit Rate</h4><div className="metric-value">{formatPercentage(derived.claimTo1stVisitRate)}</div></div>
            <div className="metric-card"><h4 className="metric-title">1st Visit to 2nd Visit Rate</h4><div className="metric-value">{formatPercentage(derived.firstTo2ndVisitRate)}</div></div>
            <div className="metric-card"><h4 className="metric-title">2nd Visit to 3rd Visit Rate</h4><div className="metric-value">{formatPercentage(derived.secondTo3rdVisitRate)}</div></div>
        </div>
      </div>
    </div>
  );
};

export default MetricsDashboard;
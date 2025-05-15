import React, { useState } from 'react';
import './MetricsTable.css'; // Ensure this CSS file exists and is styled

export default function MetricsTable({ metrics, onDeleteMetric }) {
  const [expandedNotes, setExpandedNotes] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const formatCurrency = (amount, hideZero = false) => {
    const val = parseFloat(amount);
    if (hideZero && val === 0) return '-';
    return `$${(val || 0).toFixed(2)}`;
  };

  const formatNumber = (num, hideZero = false) => {
    const val = parseFloat(num);
    if (hideZero && val === 0) return '-';
    return (val || 0).toLocaleString();
  }
  
  const calculateProfit = (metric) => {
    const revenue = parseFloat(metric.total_revenue_from_funnel_this_month || 0);
    const adSpend = parseFloat(metric.stage0_ad_spend || 0);
    const cogs1 = parseFloat(metric.stage1_cogs || 0);
    const smsCost = parseFloat(metric.stage1_sms_cost || 0); // Uses stage1_sms_cost
    const cogs2 = parseFloat(metric.stage2_cogs || 0); // Added stage2_cogs
    const cogs3 = parseFloat(metric.stage3_cogs || 0);
    
    const profit = revenue - adSpend - cogs1 - smsCost - cogs2 - cogs3;
    return { value: profit, formatted: formatCurrency(profit) };
  };
  
  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00'); // Ensure it's treated as local, not UTC midnight
    return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
  };
  
  const sortedMetrics = [...metrics].sort((a, b) => new Date(b.month) - new Date(a.month));
  
  const totals = metrics.reduce((acc, m) => {
    acc.total_ad_impressions += parseFloat(m.total_ad_impressions || 0);
    acc.total_ad_clicks += parseFloat(m.total_ad_clicks || 0);
    acc.stage0_ad_spend += parseFloat(m.stage0_ad_spend || 0);
    acc.new_leads_generated_this_month += parseFloat(m.new_leads_generated_this_month || 0);
    acc.vouchers_claimed_this_month += parseFloat(m.vouchers_claimed_this_month || 0);
    acc.first_visits_this_month += parseFloat(m.first_visits_this_month || 0);
    acc.second_visits_this_month += parseFloat(m.second_visits_this_month || 0);
    acc.third_visits_this_month += parseFloat(m.third_visits_this_month || 0);
    acc.stage1_cogs += parseFloat(m.stage1_cogs || 0);
    acc.stage1_sms_cost += parseFloat(m.stage1_sms_cost || 0);
    acc.stage2_cogs += parseFloat(m.stage2_cogs || 0);
    acc.stage3_cogs += parseFloat(m.stage3_cogs || 0);
    acc.total_revenue_from_funnel_this_month += parseFloat(m.total_revenue_from_funnel_this_month || 0);
    return acc;
  }, {
    total_ad_impressions: 0, total_ad_clicks: 0, stage0_ad_spend: 0,
    new_leads_generated_this_month: 0, vouchers_claimed_this_month: 0,
    first_visits_this_month: 0, second_visits_this_month: 0, third_visits_this_month: 0,
    stage1_cogs: 0, stage1_sms_cost: 0, stage2_cogs: 0, stage3_cogs: 0,
    total_revenue_from_funnel_this_month: 0
  });

  const totalProfit = totals.total_revenue_from_funnel_this_month - totals.stage0_ad_spend - totals.stage1_cogs - totals.stage1_sms_cost - totals.stage2_cogs - totals.stage3_cogs;

  if (!metrics || metrics.length === 0) {
    return (
      <div className="metrics-table-container">
        <p className="no-data-message">No monthly metrics data available yet.</p>
      </div>
    );
  }
  
  return (
    <div className="metrics-table-container">
      <div className="table-wrapper">
        <table className="metrics-table">
          <thead>
            <tr>
              <th className="col-month">Month</th>
              {/* Pre-Funnel */}
              <th>Ad Impr.</th>
              <th>Ad Clicks</th>
              <th className="col-ad-spend">Ad Spend</th>
              {/* In-Funnel Counts */}
              <th>New Leads</th>
              <th>Vouchers Claimed</th>
              <th>1st Visits</th>
              <th>2nd Visits</th>
              <th>3rd Visits</th>
              {/* Costs */}
              <th className="col-cogs">S1 COGS</th>
              <th className="col-sms-cost">SMS Cost</th>
              <th className="col-cogs">S2 COGS</th>
              <th className="col-cogs">S3 COGS</th>
              {/* Revenue & Profit */}
              <th className="col-revenue">Funnel Rev.</th>
              <th className="col-profit">Profit</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedMetrics.map((metric) => {
              const profit = calculateProfit(metric);
              const profitClass = profit.value >= 0 ? 'positive' : 'negative';
              const hasNotes = metric.notes && metric.notes.trim().length > 0;
              
              return (
                <React.Fragment key={metric.month}>
                  <tr>
                    <td className="col-month">
                      {formatDate(metric.month)}
                      {hasNotes && (
                        <button onClick={() => setExpandedNotes(expandedNotes === metric.month ? null : metric.month)} className="notes-toggle">
                          {expandedNotes === metric.month ? 'Hide notes' : 'Show notes'}
                        </button>
                      )}
                    </td>
                    {/* Pre-Funnel */}
                    <td>{formatNumber(metric.total_ad_impressions, true)}</td>
                    <td>{formatNumber(metric.total_ad_clicks, true)}</td>
                    <td className="col-ad-spend">{formatCurrency(metric.stage0_ad_spend, true)}</td>
                    {/* In-Funnel Counts */}
                    <td>{formatNumber(metric.new_leads_generated_this_month, true)}</td>
                    <td>{formatNumber(metric.vouchers_claimed_this_month, true)}</td>
                    <td>{formatNumber(metric.first_visits_this_month, true)}</td>
                    <td>{formatNumber(metric.second_visits_this_month, true)}</td>
                    <td>{formatNumber(metric.third_visits_this_month, true)}</td>
                    {/* Costs */}
                    <td className="col-cogs">{formatCurrency(metric.stage1_cogs, true)}</td>
                    <td className="col-sms-cost">{formatCurrency(metric.stage1_sms_cost, true)}</td>
                    <td className="col-cogs">{formatCurrency(metric.stage2_cogs, true)}</td>
                    <td className="col-cogs">{formatCurrency(metric.stage3_cogs, true)}</td>
                    {/* Revenue & Profit */}
                    <td className="col-revenue">{formatCurrency(metric.total_revenue_from_funnel_this_month, true)}</td>
                    <td className={`col-profit ${profitClass}`}>{profit.formatted}</td>
                    <td className="col-actions">
                      {deleteConfirm === metric.month ? (
                        <div className="confirm-actions">
                          <button onClick={() => { onDeleteMetric(metric.month); setDeleteConfirm(null); }} className="confirm-button">Delete</button>
                          <button onClick={() => setDeleteConfirm(null)} className="cancel-button">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(metric.month)} className="remove-button">Remove</button>
                      )}
                    </td>
                  </tr>
                  {expandedNotes === metric.month && hasNotes && (
                    <tr>
                      <td colSpan="16"> {/* Adjust colSpan to match number of columns */}
                        <div className="notes-section"><span className="notes-label">Notes:</span> {metric.notes}</div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="col-month">Total</td>
              <td>{formatNumber(totals.total_ad_impressions)}</td>
              <td>{formatNumber(totals.total_ad_clicks)}</td>
              <td className="col-ad-spend">{formatCurrency(totals.stage0_ad_spend)}</td>
              <td>{formatNumber(totals.new_leads_generated_this_month)}</td>
              <td>{formatNumber(totals.vouchers_claimed_this_month)}</td>
              <td>{formatNumber(totals.first_visits_this_month)}</td>
              <td>{formatNumber(totals.second_visits_this_month)}</td>
              <td>{formatNumber(totals.third_visits_this_month)}</td>
              <td className="col-cogs">{formatCurrency(totals.stage1_cogs)}</td>
              <td className="col-sms-cost">{formatCurrency(totals.stage1_sms_cost)}</td>
              <td className="col-cogs">{formatCurrency(totals.stage2_cogs)}</td>
              <td className="col-cogs">{formatCurrency(totals.stage3_cogs)}</td>
              <td className="col-revenue">{formatCurrency(totals.total_revenue_from_funnel_this_month)}</td>
              <td className={`col-profit ${totalProfit >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(totalProfit)}</td>
              <td className="col-actions"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
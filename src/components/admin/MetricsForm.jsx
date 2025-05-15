import React, { useState, useEffect, Fragment } from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import './MetricsForm.css'; // Create this CSS file for modal styling

// Helper component for info icon and note editing
const FieldInfo = ({ fieldKey, fieldLabel, fieldNotes, onEditNote }) => {
  return (
    <div className="field-info-header">
      <label htmlFor={fieldKey}>{fieldLabel}</label>
      <button
        type="button"
        onClick={() => onEditNote(fieldKey, fieldNotes[fieldKey] || '')}
        className="info-icon-button"
        title={`Edit note for ${fieldLabel}`}
      >
        ⓘ {/* Unicode Info Icon */}
      </button>
      {fieldNotes[fieldKey] && (
        <p className="field-info-note"><em>Note: {fieldNotes[fieldKey]}</em></p>
      )}
    </div>
  );
};


export default function MetricsForm({ onSubmit, onCancel, existingMetrics }) {
  const initialFormData = {
    month: '', selectedMonth: '', selectedYear: '',
    total_ad_impressions: '', total_ad_clicks: '', stage0_ad_spend: '',
    new_leads_generated_this_month: '', vouchers_claimed_this_month: '',
    first_visits_this_month: '', second_visits_this_month: '', third_visits_this_month: '',
    stage1_cogs: '', stage2_cogs: '', stage3_cogs: '', /* stage1_sms_cost is calculated */
    total_revenue_from_funnel_this_month: '',
    notes: ''
  };

  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [existingMonths, setExistingMonths] = useState([]);

  // For info icon notes
  const [fieldNotes, setFieldNotes] = useState({});
  const [editingNoteFor, setEditingNoteFor] = useState(null); // fieldKey string
  const [currentNoteText, setCurrentNoteText] = useState('');

  useEffect(() => {
    if (existingMetrics && existingMetrics.length > 0) {
      setExistingMonths(existingMetrics.map(metric => metric.month));
    }
    const savedNotes = localStorage.getItem('metricFormNotes');
    if (savedNotes) {
      setFieldNotes(JSON.parse(savedNotes));
    }
  }, [existingMetrics]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (formData.selectedMonth && formData.selectedYear) {
      const monthNum = parseInt(formData.selectedMonth) + 1;
      const formattedMonth = monthNum < 10 ? `0${monthNum}` : monthNum;
      setFormData(prev => ({ ...prev, month: `${formData.selectedYear}-${formattedMonth}-01` }));
    }
  }, [formData.selectedMonth, formData.selectedYear]);

  const validateForm = () => {
    if (!formData.month) {
      setError('Please select both month and year.'); return false;
    }
    if (existingMonths.includes(formData.month)) {
      setError('Data for this month already exists. Edit it from the table or choose a different month.'); return false;
    }
    const numericFields = [
      'total_ad_impressions', 'total_ad_clicks', 'stage0_ad_spend',
      'new_leads_generated_this_month', 'vouchers_claimed_this_month',
      'first_visits_this_month', 'second_visits_this_month', 'third_visits_this_month',
      'stage1_cogs', 'stage2_cogs', 'stage3_cogs',
      'total_revenue_from_funnel_this_month'
    ];
    for (const field of numericFields) {
      if (formData[field] && isNaN(parseFloat(formData[field]))) {
        setError(`Please enter a valid number for ${field.replace(/_/g, ' ')}.`); return false;
      }
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);

    const calculatedSmsCost = (parseFloat(formData.vouchers_claimed_this_month) || 0) * 0.1091;

    const submissionData = {
      month: formData.month,
      total_ad_impressions: parseFloat(formData.total_ad_impressions) || 0,
      total_ad_clicks: parseFloat(formData.total_ad_clicks) || 0,
      stage0_ad_spend: parseFloat(formData.stage0_ad_spend) || 0,
      new_leads_generated_this_month: parseFloat(formData.new_leads_generated_this_month) || 0,
      vouchers_claimed_this_month: parseFloat(formData.vouchers_claimed_this_month) || 0,
      first_visits_this_month: parseFloat(formData.first_visits_this_month) || 0,
      second_visits_this_month: parseFloat(formData.second_visits_this_month) || 0,
      third_visits_this_month: parseFloat(formData.third_visits_this_month) || 0,
      stage1_cogs: parseFloat(formData.stage1_cogs) || 0,
      stage1_sms_cost: calculatedSmsCost.toFixed(2), // Store as fixed 2 decimal places
      stage2_cogs: parseFloat(formData.stage2_cogs) || 0,
      stage3_cogs: parseFloat(formData.stage3_cogs) || 0,
      total_revenue_from_funnel_this_month: parseFloat(formData.total_revenue_from_funnel_this_month) || 0,
      notes: formData.notes
    };

    try {
      const success = await onSubmit(submissionData);
      if (success) {
        setFormData(initialFormData); // Reset form on successful submission
      }
    } catch (err) {
      console.error('Error submitting metrics:', err);
      setError('An unexpected error occurred during submission.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getYears = () => {
    const years = [];
    for (let i = 2025; i <= 2030; i++) years.push(i);
    return years.sort((a, b) => b - a);
  };
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Note editing functions
  const handleEditNote = (fieldKey, currentText) => {
    setEditingNoteFor(fieldKey);
    setCurrentNoteText(currentText);
  };

  const handleSaveNote = () => {
    if (editingNoteFor) {
      const updatedNotes = { ...fieldNotes, [editingNoteFor]: currentNoteText };
      setFieldNotes(updatedNotes);
      localStorage.setItem('metricFormNotes', JSON.stringify(updatedNotes));
    }
    setEditingNoteFor(null);
    setCurrentNoteText('');
  };

  const renderFieldWithInfo = (fieldKey, label, type = "number", placeholder = "0", step = "1") => (
    <div className="form-group">
      <FieldInfo fieldKey={fieldKey} fieldLabel={label} fieldNotes={fieldNotes} onEditNote={handleEditNote} />
      <Input
        id={fieldKey} name={fieldKey} type={type} min="0" step={step}
        value={formData[fieldKey]} onChange={handleChange} placeholder={placeholder}
      />
    </div>
  );


  return (
    <div className="metrics-form-container">
      <h3>Add/Edit Monthly Metrics</h3>
      {error && <div className="error-message">{error}</div>}
      <form onSubmit={handleSubmit}>
        {/* Month/Year Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="form-group">
            <FieldInfo fieldKey="month_selection" fieldLabel="Month & Year" fieldNotes={fieldNotes} onEditNote={handleEditNote} />
            <select id="selectedMonth" name="selectedMonth" value={formData.selectedMonth} onChange={handleChange} required>
              <option value="">Select Month</option>
              {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="selectedYear" style={{opacity: 0}}>Year</label> {/* Hidden label for spacing */}
            <select id="selectedYear" name="selectedYear" value={formData.selectedYear} onChange={handleChange} required>
              <option value="">Select Year</option>
              {getYears().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <h4>Pre-Funnel Metrics</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderFieldWithInfo("total_ad_impressions", "Total Ad Impressions")}
          {renderFieldWithInfo("total_ad_clicks", "Total Ad Clicks")}
          {renderFieldWithInfo("stage0_ad_spend", "Ad Spend ($)", "number", "0.00", "0.01")}
        </div>

        <h4>In-Funnel Counts (Events this month)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderFieldWithInfo("new_leads_generated_this_month", "New Leads Generated")}
          {renderFieldWithInfo("vouchers_claimed_this_month", "Vouchers Claimed (Spicy Marg)")}
          {renderFieldWithInfo("first_visits_this_month", "1st Visits (Spicy Marg Redeemed)")}
          {renderFieldWithInfo("second_visits_this_month", "2nd Visits (Icey Marg Redeemed)")}
          {renderFieldWithInfo("third_visits_this_month", "3rd Visits (Funnel Completed)")}
        </div>
        
        <h4>In-Funnel Costs & Revenue ($)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {renderFieldWithInfo("stage1_cogs", "Spicy Margarita COGS (1st Visit)", "number", "0.00", "0.01")}
          {renderFieldWithInfo("stage2_cogs", "Icey Margarita COGS (2nd Visit)", "number", "0.00", "0.01")}
          {renderFieldWithInfo("stage3_cogs", "House Cocktail COGS (3rd Visit)", "number", "0.00", "0.01")}
          <div className="form-group">
            <FieldInfo fieldKey="stage1_sms_cost_info" fieldLabel="SMS Cost (Auto-Calculated)" fieldNotes={fieldNotes} onEditNote={handleEditNote} />
            <Input
                type="text"
                value={`$${((parseFloat(formData.vouchers_claimed_this_month) || 0) * 0.1091).toFixed(2)}`}
                readOnly
                disabled
            />
            <p className="small-text">Based on {formData.vouchers_claimed_this_month || 0} vouchers claimed @ $0.1091 each.</p>
          </div>
          {renderFieldWithInfo("total_revenue_from_funnel_this_month", "Total Revenue from Funnel", "number", "0.00", "0.01")}
        </div>
        
        <div className="form-group mt-4">
          <FieldInfo fieldKey="general_notes" fieldLabel="General Notes for this month" fieldNotes={fieldNotes} onEditNote={handleEditNote} />
          <textarea id="notes" name="notes" value={formData.notes} onChange={handleChange} placeholder="Any observations..." rows="3"/>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || !formData.month}>
            {isSubmitting ? 'Saving...' : 'Save Metrics'}
          </Button>
        </div>
      </form>

      {editingNoteFor && (
        <div className="note-editor-modal-overlay">
          <div className="note-editor-modal-content">
            <h4>Edit Note for: {editingNoteFor.replace(/_/g, ' ')}</h4>
            <textarea
              value={currentNoteText}
              onChange={(e) => setCurrentNoteText(e.target.value)}
              rows="4"
              style={{ width: '100%', marginBottom: '10px' }}
              autoFocus
            />
            <div style={{ textAlign: 'right' }}>
              <Button onClick={() => setEditingNoteFor(null)} variant="secondary" size="small" style={{ marginRight: '10px' }}>Cancel</Button>
              <Button onClick={handleSaveNote} variant="primary" size="small">Save Note</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
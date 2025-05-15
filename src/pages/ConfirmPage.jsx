import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import Layout from '../components/common/Layout';
import VisitConfirm from '../components/confirm/VisitConfirm';

export default function ConfirmPage() {
  const { token } = useParams();
  
  // Redirect to landing page if no token
  if (!token) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <Layout>
      <div className="confirm-page">
        <VisitConfirm />
      </div>
    </Layout>
  );
}
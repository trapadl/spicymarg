import React from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import Layout from '../components/common/Layout';
import VoucherForm from '../components/voucher/VoucherForm';

export default function VoucherPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  // Redirect to landing page if no token
  if (!token) {
    return <Navigate to="/" replace />;
  }
  
  return (
    <Layout>
      <div className="voucher-page">
        <VoucherForm />
      </div>
    </Layout>
  );
}
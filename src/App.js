import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Loans from './pages/Loans';
import LoanDetails from './pages/LoanDetails';
import Customers from './pages/Customers';
import CustomerDetails from './pages/CustomerDetails';
import Enquiries from './pages/Enquiries';
import Users from './pages/Users';
import Activities from './pages/Activities';
import Placeholder from './pages/Placeholder';
import Lenders from './pages/Lenders';
import LenderLogins from './pages/LenderLogins';
import Leads from './pages/Leads';
import RecycleBin from './pages/RecycleBin';
import RoiCalculator from './pages/RoiCalculator';
import BackupCenter from './pages/BackupCenter';
import Layout from './components/Layout';
import './App.css';

function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="loans" element={<Loans />} />
          <Route path="loans/status/:statusSlug" element={<Loans />} />
          <Route path="loans/:id" element={<LoanDetails />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetails />} />
          <Route path="recycle-bin" element={<RecycleBin />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="leads" element={<Leads />} />
          <Route path="callbacks" element={<Placeholder title="Callbacks" />} />
          <Route path="files" element={<Placeholder title="Files" />} />
          <Route path="credit-eval" element={<Placeholder title="Credit Evaluation" />} />
          <Route path="logins" element={<Placeholder title="Logins" />} />
          <Route path="file-in-process" element={<Placeholder title="File In Process" />} />
          <Route path="sanctions" element={<Placeholder title="Sanctions" />} />
          <Route path="disbursals" element={<Placeholder title="Disbursals" />} />
          <Route path="rejects" element={<Placeholder title="Rejects" />} />
          <Route path="activities" element={<Activities />} />
          <Route path="users" element={<Users />} />
          <Route path="lenders" element={<Lenders />} />
          <Route path="lenders/:id/logins" element={<LenderLogins />} />
          <Route path="reports" element={<Placeholder title="Reports" />} />
          <Route path="accounting" element={<Placeholder title="Accounting" />} />
          <Route path="integrations" element={<Placeholder title="Integrations" />} />
          <Route path="settings" element={<Placeholder title="Settings" />} />
          <Route path="knowledge" element={<Placeholder title="Knowledge Hub" />} />
          <Route path="hrm" element={<Placeholder title="HRM" />} />
          <Route path="roi" element={<RoiCalculator />} />
          <Route path="backup" element={<BackupCenter />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;

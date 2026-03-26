import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchCustomerRecord, readCachedCustomers, readCachedLoans } from '../utils/crmData';
import './CustomerDetails.css';

function buildFallbackCustomer(id) {
  const cachedCustomers = readCachedCustomers();
  const cachedLoans = readCachedLoans();
  const matchedCustomer = cachedCustomers.find((customer) => String(customer.id) === String(id));

  if (!matchedCustomer) {
    return null;
  }

  return {
    ...matchedCustomer,
    loans: cachedLoans
      .filter((loan) => String(loan.customerId) === String(id))
      .map((loan) => ({
        id: loan.id,
        type: loan.type,
        amount: loan.amount,
        status: loan.status,
        emi: loan.emi,
      })),
    documents: matchedCustomer.documents || [],
    activities: matchedCustomer.activities || [],
  };
}

function CustomerDetails() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(() => buildFallbackCustomer(id));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadCustomer = async () => {
      try {
        setLoading(true);
        setError('');
        const nextCustomer = await fetchCustomerRecord(id);
        if (isMounted) {
          setCustomer(nextCustomer);
        }
      } catch (loadError) {
        if (isMounted) {
          setCustomer(buildFallbackCustomer(id));
          setError(loadError.message || 'Failed to load customer details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCustomer();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading && !customer) {
    return (
      <div className="customer-details">
        <div className="details-card">
          <p>Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="customer-details">
        <div className="details-card">
          <Link to="/customers" className="back-link">← Back to Customers</Link>
          <h1>Customer not found</h1>
          {error ? <p>{error}</p> : null}
        </div>
      </div>
    );
  }

  const loans = Array.isArray(customer.loans) ? customer.loans : [];
  const documents = Array.isArray(customer.documents) ? customer.documents : [];
  const activities = Array.isArray(customer.activities) ? customer.activities : [];

  return (
    <div className="customer-details">
      {error ? <div className="error-message">{error}</div> : null}

      <div className="details-header">
        <div>
          <Link to="/customers" className="back-link">← Back to Customers</Link>
          <h1>{customer.name}</h1>
        </div>
        <span className={`status-badge status-${customer.status.toLowerCase()}`}>
          {customer.status}
        </span>
      </div>

      <div className="details-grid">
        <div className="details-card profile-card">
          <div className="profile-header">
            <div className="profile-avatar">
              {customer.name.split(' ').map((namePart) => namePart[0]).join('')}
            </div>
            <div>
              <h2>{customer.name}</h2>
              <p className="occupation">{customer.occupation || 'No occupation recorded'}</p>
            </div>
          </div>
          <div className="profile-info">
            <div className="info-item">
              <span className="info-icon">📧</span>
              <div>
                <label>Email</label>
                <span>{customer.email || '-'}</span>
              </div>
            </div>
            <div className="info-item">
              <span className="info-icon">📱</span>
              <div>
                <label>Phone</label>
                <span>{customer.phone || '-'}</span>
              </div>
            </div>
            <div className="info-item">
              <span className="info-icon">📍</span>
              <div>
                <label>Address</label>
                <span>{customer.address || '-'}</span>
              </div>
            </div>
            <div className="info-item">
              <span className="info-icon">🎂</span>
              <div>
                <label>Date of Birth</label>
                <span>{customer.dateOfBirth || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="details-card">
          <h2>Financial Information</h2>
          <div className="financial-grid">
            <div className="financial-item">
              <label>Monthly Income</label>
              <span>₹{Number(customer.income || 0).toLocaleString()}</span>
            </div>
            <div className="financial-item">
              <label>PAN Number</label>
              <span>{customer.panNumber || '-'}</span>
            </div>
            <div className="financial-item">
              <label>Aadhar Number</label>
              <span>{customer.aadharNumber || '-'}</span>
            </div>
            <div className="financial-item">
              <label>Member Since</label>
              <span>{customer.joinDate || '-'}</span>
            </div>
          </div>
        </div>

        <div className="details-card full-width">
          <div className="card-header">
            <h2>Loans</h2>
            <Link to="/loans" className="view-all">View All →</Link>
          </div>
          <table className="loans-table">
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Type</th>
                <th>Amount</th>
                <th>EMI</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr>
                  <td colSpan="6">No loans linked to this customer yet.</td>
                </tr>
              ) : loans.map((loan) => (
                <tr key={loan.id}>
                  <td>#{loan.id.toString().padStart(4, '0')}</td>
                  <td>{loan.type}</td>
                  <td>₹{Number(loan.amount || 0).toLocaleString()}</td>
                  <td>{loan.emi > 0 ? `₹${Number(loan.emi).toLocaleString()}` : '-'}</td>
                  <td>
                    <span className={`status-badge status-${String(loan.status || '').toLowerCase()}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td>
                    <Link to={`/loans/${loan.id}`} className="action-link">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="details-card">
          <h2>Documents</h2>
          <div className="documents-list">
            {documents.length === 0 ? (
              <div className="document-item">
                <span className="doc-name">No documents recorded yet.</span>
              </div>
            ) : documents.map((doc, index) => (
              <div key={index} className="document-item">
                <span className="doc-icon">📄</span>
                <div className="doc-info">
                  <span className="doc-name">{doc.name}</span>
                  <span className="doc-date">{doc.date || '-'}</span>
                </div>
                <span className={`doc-status status-${String(doc.status || '').toLowerCase()}`}>
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="details-card">
          <h2>Recent Activity</h2>
          <div className="activity-list">
            {activities.length === 0 ? (
              <div className="activity-item">
                <div className="activity-content">
                  <p className="activity-desc">No customer-specific activity recorded yet.</p>
                </div>
              </div>
            ) : activities.map((activity, index) => (
              <div key={index} className="activity-item">
                <div className={`activity-icon ${activity.type || 'loan'}`}>
                  {activity.type === 'payment' && '💰'}
                  {activity.type === 'document' && '📄'}
                  {activity.type !== 'payment' && activity.type !== 'document' && '📋'}
                </div>
                <div className="activity-content">
                  <p className="activity-desc">{activity.description || activity.message}</p>
                  <span className="activity-date">{activity.date || '-'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerDetails;

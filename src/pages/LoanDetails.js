import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './LoanDetails.css';
import {
  formatTenureYears,
  getLoanStatusTone,
} from '../utils/loanWorkflow';
import { fetchLoanRecord, readCachedLoans } from '../utils/crmData';

function LoanDetails() {
  const { id } = useParams();
  const [loan, setLoan] = useState(() => readCachedLoans().find((item) => String(item.id) === String(id)) || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadLoan = async () => {
      try {
        setLoading(true);
        setError('');
        const nextLoan = await fetchLoanRecord(id);
        if (isMounted) {
          setLoan(nextLoan);
        }
      } catch (loadError) {
        if (isMounted) {
          setLoan(readCachedLoans().find((item) => String(item.id) === String(id)) || null);
          setError(loadError.message || 'Failed to load loan details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadLoan();

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading && !loan) {
    return (
      <div className="loan-details">
        <div className="details-card">
          <p>Loading loan details...</p>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="loan-details">
        <div className="details-card">
          <Link to="/loans" className="back-link">Back to Loans</Link>
          <h1>Loan not found</h1>
          {error ? <p>{error}</p> : null}
        </div>
      </div>
    );
  }

  const documents = Array.isArray(loan.documents) ? loan.documents : [];
  const emiHistory = Array.isArray(loan.emiHistory) ? loan.emiHistory : [];

  return (
    <div className="loan-details">
      {error ? <div className="error-message">{error}</div> : null}

      <div className="details-header">
        <div>
          <Link to="/loans" className="back-link">Back to Loans</Link>
          <h1>Loan #{String(id || loan.id || 1).padStart(4, '0')}</h1>
        </div>
        <span className={`status-badge status-${getLoanStatusTone(loan.status)}`}>
          {loan.status || 'Unknown'}
        </span>
      </div>

      <div className="details-grid">
        <div className="details-card">
          <h2>Loan Information</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Loan Type</label>
              <span>{loan.type}</span>
            </div>
            <div className="info-item">
              <label>Lender Name</label>
              <span>{loan.lenderName || '-'}</span>
            </div>
            <div className="info-item">
              <label>Refference Name</label>
              <span>{loan.referenceName || '-'}</span>
            </div>
            <div className="info-item">
              <label>Loan Amount</label>
              <span>Rs. {(loan.amount || 0).toLocaleString()}</span>
            </div>
            <div className="info-item">
              <label>Interest Rate</label>
              <span>{loan.interest}% p.a.</span>
            </div>
            <div className="info-item">
              <label>Tenure</label>
              <span>{formatTenureYears(loan.tenure)}</span>
            </div>
            <div className="info-item">
              <label>EMI Amount</label>
              <span>Rs. {(loan.emi || 0).toLocaleString()}</span>
            </div>
            <div className="info-item">
              <label>Next EMI Date</label>
              <span>{loan.nextEmiDate || '-'}</span>
            </div>
          </div>
        </div>

        <div className="details-card">
          <h2>Customer Details</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>Name</label>
              <Link to={`/customers/${loan.customerId}`} className="customer-link">
                {loan.customer}
              </Link>
            </div>
            <div className="info-item">
              <label>Email</label>
              <span>{loan.email || '-'}</span>
            </div>
            <div className="info-item">
              <label>Phone</label>
              <span>{loan.phone || '-'}</span>
            </div>
          </div>
        </div>

        <div className="details-card">
          <h2>Payment Summary</h2>
          <div className="summary-stats">
            <div className="summary-item">
              <span className="summary-value">Rs. {(loan.disbursedAmount || 0).toLocaleString()}</span>
              <span className="summary-label">Disbursed</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">Rs. {(loan.outstandingAmount || 0).toLocaleString()}</span>
              <span className="summary-label">Outstanding</span>
            </div>
            <div className="summary-item">
              <span className="summary-value">Rs. {((loan.disbursedAmount || 0) - (loan.outstandingAmount || 0)).toLocaleString()}</span>
              <span className="summary-label">Paid</span>
            </div>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${loan.disbursedAmount ? (((loan.disbursedAmount - (loan.outstandingAmount || 0)) / loan.disbursedAmount) * 100) : 0}%` }}
            ></div>
          </div>
        </div>

        <div className="details-card">
          <h2>Timeline</h2>
          <div className="timeline">
            <div className="timeline-item completed">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <span className="timeline-title">Application Submitted</span>
                <span className="timeline-date">{loan.appliedDate || '-'}</span>
              </div>
            </div>
            <div className="timeline-item completed">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <span className="timeline-title">Loan Sanctioned</span>
                <span className="timeline-date">{loan.approvedDate || '-'}</span>
              </div>
            </div>
            <div className="timeline-item completed">
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <span className="timeline-title">Amount Disbursed</span>
                <span className="timeline-date">{loan.disbursedDate || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="details-card full-width">
          <h2>Documents</h2>
          <div className="documents-list">
            {documents.length === 0 ? (
              <div className="document-item">
                <span className="doc-name">No documents recorded yet.</span>
              </div>
            ) : documents.map((doc, index) => (
              <div key={index} className="document-item">
                <span className="doc-icon">-</span>
                <span className="doc-name">{doc.name}</span>
                <span className={`doc-status status-${String(doc.status || '').toLowerCase()}`}>
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="details-card full-width">
          <h2>EMI History</h2>
          <table className="emi-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {emiHistory.length === 0 ? (
                <tr>
                  <td colSpan="3">No EMI history recorded yet.</td>
                </tr>
              ) : emiHistory.map((emi, index) => (
                <tr key={index}>
                  <td>{emi.date}</td>
                  <td>Rs. {Number(emi.amount || 0).toLocaleString()}</td>
                  <td>
                    <span className={`status-badge status-${String(emi.status || '').toLowerCase()}`}>
                      {emi.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LoanDetails;

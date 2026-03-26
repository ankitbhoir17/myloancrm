import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import './Lenders.css';
import { fetchLenderLogins } from '../utils/lenderLogins';
import { LOAN_STATUS_FLOW } from '../utils/loanWorkflow';
import { buildLenderInsight, formatCurrency, mergeLendersWithFlow, readStoredLoans } from '../utils/lenderFlow';
import { readCachedLenders, syncLendersCache } from '../utils/lendersData';

function readStoredLenders(loans = readStoredLoans()) {
  return mergeLendersWithFlow(readCachedLenders(), loans);
}

function formatDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
}

function getFlowToneClass(tone) {
  switch (tone) {
    case 'approved':
      return 'tone-approved';
    case 'rejected':
      return 'tone-rejected';
    case 'disbursed':
      return 'tone-disbursed';
    case 'paid':
      return 'tone-paid';
    case 'active':
      return 'tone-active';
    default:
      return 'tone-pending';
  }
}

function getLoginStatusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('done') || normalized.includes('success')) {
    return 'login-status is-success';
  }
  if (normalized.includes('review') || normalized.includes('pending')) {
    return 'login-status is-review';
  }
  return 'login-status is-danger';
}

function formatProductLabel(value) {
  switch (String(value || '').toLowerCase()) {
    case 'business':
      return 'Business Loan';
    case 'home':
      return 'Home Loan';
    case 'vehicle':
      return 'Vehicle Loan';
    case 'personal':
      return 'Personal Loan';
    default:
      return value ? String(value) : 'General';
  }
}

function LenderLogins() {
  const { id } = useParams();
  const [lenders, setLenders] = useState(() => readStoredLenders());
  const [allLoans, setAllLoans] = useState(() => readStoredLoans());
  const [search, setSearch] = useState('');
  const [product, setProduct] = useState('all');
  const [loginStatusFilter, setLoginStatusFilter] = useState('all');
  const [loanSearch, setLoanSearch] = useState('');
  const [loanFlowFilter, setLoanFlowFilter] = useState('all');
  const [logins, setLogins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingLender, setLoadingLender] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadLenders = async () => {
      try {
        const nextLoans = readStoredLoans();
        const nextLenders = await syncLendersCache();
        if (mounted) {
          setAllLoans(nextLoans);
          setLenders(mergeLendersWithFlow(nextLenders, nextLoans));
        }
      } catch (loadError) {
        if (mounted) {
          setAllLoans(readStoredLoans());
          setLenders(readStoredLenders());
        }
      } finally {
        if (mounted) {
          setLoadingLender(false);
        }
      }
    };

    loadLenders();

    const syncData = (event) => {
      const key = event?.detail?.key || event?.key;
      if (!key || key === 'lenders') {
        setLenders(readStoredLenders(allLoans));
      }
      if (!key || key === 'loans') {
        const nextLoans = readStoredLoans();
        setAllLoans(nextLoans);
        setLenders(readStoredLenders(nextLoans));
      }
    };

    window.addEventListener('storage', syncData);
    window.addEventListener('focus', syncData);
    window.addEventListener('app:storage-changed', syncData);

    return () => {
      mounted = false;
      window.removeEventListener('storage', syncData);
      window.removeEventListener('focus', syncData);
      window.removeEventListener('app:storage-changed', syncData);
    };
  }, [allLoans]);

  const lender = lenders.find((item) => String(item.id) === String(id)) || { id, name: 'Lender', status: 'Inactive' };

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError('');
    setNotice('');

    fetchLenderLogins(id)
      .then(({ data, warning }) => {
        if (!mounted) {
          return;
        }

        setLogins(data || []);
        if (warning) {
          if ((data || []).length > 0) {
            setNotice(warning);
          } else {
            setError(warning);
          }
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to load lender logins');
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const flowInsight = useMemo(() => buildLenderInsight(lender, allLoans), [allLoans, lender]);

  const productOptions = useMemo(() => Array.from(new Set(
    logins.map((item) => item.product || 'general')
  )), [logins]);

  const loginStatusOptions = useMemo(() => Array.from(new Set(
    logins.map((item) => item.status || 'Pending')
  )), [logins]);

  const filteredLogins = useMemo(() => logins.filter((item) => {
    const query = search.trim().toLowerCase();
    const haystack = [
      item.leadName,
      item.businessName,
      item.surrogate,
      item.remarks,
      item.status,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesProduct = product === 'all' || (item.product || 'general') === product;
    const matchesStatus = loginStatusFilter === 'all' || (item.status || 'Pending') === loginStatusFilter;
    return matchesSearch && matchesProduct && matchesStatus;
  }), [logins, loginStatusFilter, product, search]);

  const filteredLoans = useMemo(() => flowInsight.relatedLoans.filter((loan) => {
    const query = loanSearch.trim().toLowerCase();
    const haystack = [
      loan.customer,
      loan.referenceName,
      loan.status,
      loan.type,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    const matchesFlow = loanFlowFilter === 'all' || loan.status === loanFlowFilter;
    return matchesSearch && matchesFlow;
  }), [flowInsight.relatedLoans, loanFlowFilter, loanSearch]);

  const loginStats = useMemo(() => ({
    successful: logins.filter((item) => String(item.status || '').toLowerCase().includes('done')).length,
    review: logins.filter((item) => {
      const normalized = String(item.status || '').toLowerCase();
      return normalized.includes('review') || normalized.includes('pending');
    }).length,
    failed: logins.filter((item) => {
      const normalized = String(item.status || '').toLowerCase();
      return normalized.includes('fail') || normalized.includes('reject');
    }).length,
  }), [logins]);

  const summaryText = filteredLogins.length
    ? `Showing 1 to ${filteredLogins.length} of ${filteredLogins.length} lender logins`
    : 'Showing 0 to 0 of 0 lender logins';

  return (
    <div className="lenders-page">
      <div className="page-header">
        <div>
          <Link to="/lenders" className="back-link">Back to lenders</Link>
          <h1>{lender.name}</h1>
          <p className="lenders-subtitle">Lender logins and linked loan cases are now synchronized with the shared CRM flow.</p>
        </div>
        {flowInsight.totalCases > 0 ? (
          <span className={`flow-badge large ${getFlowToneClass(flowInsight.currentFlowTone)}`}>{flowInsight.currentFlow}</span>
        ) : null}
      </div>

      <div className="lender-stats-grid">
        <div className="lender-stat-card">
          <span className="lender-stat-label">Total Logins</span>
          <strong className="lender-stat-value">{logins.length}</strong>
        </div>
        <div className="lender-stat-card">
          <span className="lender-stat-label">Successful</span>
          <strong className="lender-stat-value">{loginStats.successful}</strong>
        </div>
        <div className="lender-stat-card">
          <span className="lender-stat-label">In Review</span>
          <strong className="lender-stat-value">{loginStats.review}</strong>
        </div>
        <div className="lender-stat-card">
          <span className="lender-stat-label">Failed</span>
          <strong className="lender-stat-value">{loginStats.failed}</strong>
        </div>
        <div className="lender-stat-card">
          <span className="lender-stat-label">Linked Cases</span>
          <strong className="lender-stat-value">{flowInsight.totalCases}</strong>
        </div>
      </div>

      <div className="flow-pill-row">
        {flowInsight.flowBreakdown.map((item) => (
          <button
            key={item.status}
            type="button"
            className={`flow-pill ${loanFlowFilter === item.status ? 'active' : ''}`}
            onClick={() => setLoanFlowFilter((current) => (current === item.status ? 'all' : item.status))}
          >
            <span>{item.status}</span>
            <strong>{item.count}</strong>
          </button>
        ))}
      </div>

      <div className="section">
        <div className="section-header">
          <h2>Lender Logins</h2>
          <span className="section-note">{summaryText}</span>
        </div>

        <div className="lenders-toolbar inline">
          <input
            placeholder="Search by lead, surrogate, remarks, or login status"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={product} onChange={(e) => setProduct(e.target.value)}>
            <option value="all">All Products</option>
            {productOptions.map((item) => (
              <option key={item} value={item}>{formatProductLabel(item)}</option>
            ))}
          </select>
          <select value={loginStatusFilter} onChange={(e) => setLoginStatusFilter(e.target.value)}>
            <option value="all">All Login Status</option>
            {loginStatusOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        {notice ? <div className="notice-banner">{notice}</div> : null}
        {error ? <div className="error-banner">{error}</div> : null}

        <div className="lenders-table-wrap compact">
          <table className="lenders-table">
            <thead>
              <tr>
                <th>Lead Name</th>
                <th>Surrogate</th>
                <th>Product</th>
                <th>Login Date</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading || loadingLender ? (
                <tr>
                  <td colSpan={6} className="empty-table-state">Loading lender logins...</td>
                </tr>
              ) : filteredLogins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-table-state">No lender logins match the selected filters.</td>
                </tr>
              ) : (
                filteredLogins.map((item, index) => (
                  <tr key={item._id || index}>
                    <td>{item.leadName || '-'}</td>
                    <td>{item.surrogate || '-'}</td>
                    <td>{formatProductLabel(item.product)}</td>
                    <td>{formatDate(item.loginDate)}</td>
                    <td><span className={getLoginStatusClass(item.status)}>{item.status || 'Pending'}</span></td>
                    <td>{item.remarks || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h2>Related Loan Flow</h2>
          <span className="section-note">{flowInsight.totalCases} linked lender cases</span>
        </div>

        <div className="lenders-toolbar inline">
          <input
            placeholder="Search by customer, reference, type, or stage"
            value={loanSearch}
            onChange={(e) => setLoanSearch(e.target.value)}
          />
          <select value={loanFlowFilter} onChange={(e) => setLoanFlowFilter(e.target.value)}>
            <option value="all">All Flow Stages</option>
            {LOAN_STATUS_FLOW.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        <div className="lenders-table-wrap compact">
          <table className="lenders-table">
            <thead>
              <tr>
                <th>Loan ID</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-state">No linked loan cases match the selected flow filters.</td>
                </tr>
              ) : (
                filteredLoans.map((loan) => {
                  const tone = flowInsight.flowBreakdown.find((item) => item.status === loan.status)?.tone || flowInsight.currentFlowTone;
                  return (
                    <tr key={loan.id}>
                      <td>#{String(loan.id).padStart(4, '0')}</td>
                      <td>{loan.customer || '-'}</td>
                      <td>{loan.type || '-'}</td>
                      <td>{formatCurrency(loan.amount)}</td>
                      <td><span className={`flow-badge ${getFlowToneClass(tone)}`}>{loan.status}</span></td>
                      <td>{formatDate(loan.date)}</td>
                      <td>
                        <Link to={`/loans/${loan.id}`} className="table-link">Open Loan</Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default LenderLogins;

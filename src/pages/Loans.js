import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addActivity } from '../utils/activities';
import CustomerSelect from '../components/CustomerSelect';
import {
  DEFAULT_LOAN_STATUS,
  formatLoanDisplayId,
  formatLoanCreatedAt,
  formatLoanCreatedDate,
  getLoanCreatedDate,
  formatTenureYears,
  LOAN_STATUS_FLOW,
  getLoanStatusBySlug,
} from '../utils/loanWorkflow';
import { addToRecycleBin } from '../utils/recycleBin';
import { restoreDeletedEntry } from '../utils/recycleBinApi';
import {
  createLoanRecord,
  deleteLoanRecord,
  readCachedCustomers,
  readCachedLoans,
  syncLoansCache,
  updateLoanRecord,
  writeCachedLoans,
} from '../utils/crmData';
import './Loans.css';

const emptyLoanForm = {
  loanId: '',
  customerId: '',
  customer: '',
  lenderName: '',
  referenceName: '',
  amount: '',
  type: 'Personal',
  interest: '',
  tenure: '',
  status: DEFAULT_LOAN_STATUS,
};

function recordActivitySafely(payload) {
  try {
    addActivity(payload);
  } catch (error) {
    // Ignore activity failures to keep loan actions responsive.
  }
}

function Loans() {
  const { statusSlug } = useParams();
  const [loans, setLoans] = useState(() => readCachedLoans());
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [pageError, setPageError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => getLoanStatusBySlug(statusSlug) || 'all');
  const [showModal, setShowModal] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState(null);
  const [newLoan, setNewLoan] = useState(emptyLoanForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const canDelete = user?.role === 'superuser';

  const toastTimerRef = useRef(null);
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    loanId: null,
    prevStatus: null,
    action: null,
    entry: null,
  });

  useEffect(() => {
    setStatusFilter(getLoanStatusBySlug(statusSlug) || 'all');
  }, [statusSlug]);

  useEffect(() => {
    let isMounted = true;

    const loadLoans = async () => {
      try {
        setLoadingLoans(true);
        setPageError('');
        const nextLoans = await syncLoansCache();
        if (isMounted) {
          setLoans(nextLoans);
        }
      } catch (error) {
        if (isMounted) {
          setLoans(readCachedLoans());
          setPageError(error.message || 'Failed to load loans from the server.');
        }
      } finally {
        if (isMounted) {
          setLoadingLoans(false);
        }
      }
    };

    loadLoans();

    return () => {
      isMounted = false;
    };
  }, []);

  const clearToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ visible: false, message: '', loanId: null, prevStatus: null, action: null, entry: null });
  };

  const showToast = (message, loanId, prevStatus = null, action = 'status', entry = null) => {
    clearToast();
    setToast({ visible: true, message, loanId, prevStatus, action, entry });
    toastTimerRef.current = setTimeout(() => {
      clearToast();
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const filteredLoans = loans.filter((loan) => {
    const searchValue = searchTerm.toLowerCase();
    const matchesSearch = [
      loan.loanId,
      loan.id,
      loan.customer,
      loan.lenderName,
      loan.referenceName,
      loan.date,
      loan.createdAt,
      formatLoanCreatedDate(loan),
    ]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(searchValue));
    const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
    const createdAt = getLoanCreatedDate(loan);
    const fromDate = createdFrom ? new Date(`${createdFrom}T00:00:00`) : null;
    const toDate = createdTo ? new Date(`${createdTo}T23:59:59.999`) : null;
    const matchesFrom = !fromDate || (createdAt && createdAt >= fromDate);
    const matchesTo = !toDate || (createdAt && createdAt <= toDate);
    return matchesSearch && matchesStatus && matchesFrom && matchesTo;
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingLoanId(null);
    setNewLoan(emptyLoanForm);
    setFormError('');
    setSaving(false);
  };

  const openCreateModal = () => {
    setEditingLoanId(null);
    setNewLoan(emptyLoanForm);
    setFormError('');
    setShowModal(true);
  };

  const persistLoans = (nextLoans) => {
    setLoans(nextLoans);
    writeCachedLoans(nextLoans);
  };

  const handleSaveLoan = async (e) => {
    e.preventDefault();
    setSaving(true);
    setPageError('');
    setFormError('');

    const matchedCustomer = newLoan.customerId
      ? null
      : readCachedCustomers().find(
          (customer) => (customer.name || '').trim().toLowerCase() === newLoan.customer.trim().toLowerCase()
        );
    const customerId = newLoan.customerId || (matchedCustomer ? String(matchedCustomer.id) : '');
    const customerName = matchedCustomer?.name || newLoan.customer;

    if (!newLoan.loanId.trim()) {
      setFormError('Loan ID is required.');
      setSaving(false);
      return;
    }

    if (!customerId) {
      setFormError('Select an existing customer from the customer suggestions before creating the loan.');
      setSaving(false);
      return;
    }

    const payload = {
      loanId: newLoan.loanId.trim(),
      customerId,
      customer: customerName,
      lenderName: newLoan.lenderName,
      referenceName: newLoan.referenceName,
      amount: Number(newLoan.amount) || 0,
      type: newLoan.type,
      interest: Number(newLoan.interest) || 0,
      tenure: Number(newLoan.tenure) || 0,
      status: newLoan.status || DEFAULT_LOAN_STATUS,
    };

    try {
      let nextLoans = loans;

      if (editingLoanId) {
        const updatedLoan = await updateLoanRecord(editingLoanId, payload);
        nextLoans = loans.map((loan) => (
          loan.id === editingLoanId ? updatedLoan : loan
        ));
      } else {
        const createdLoan = await createLoanRecord(payload);
        nextLoans = [createdLoan, ...loans];

        recordActivitySafely({
          type: 'loan_created',
          actor: user?.username || 'system',
          message: `Loan ${formatLoanDisplayId(createdLoan)} created for ${createdLoan.customer}`,
          meta: { loanId: createdLoan.id },
        });
      }

      persistLoans(nextLoans);
      closeModal();
    } catch (error) {
      setFormError(error.message || 'Failed to save loan.');
      setSaving(false);
    }
  };

  const handleEditClick = (loan) => {
    setEditingLoanId(loan.id);
    setFormError('');
    setNewLoan({
      loanId: loan.loanId || '',
      customerId: loan.customerId || '',
      customer: loan.customer || '',
      lenderName: loan.lenderName || '',
      referenceName: loan.referenceName || '',
      amount: loan.amount != null ? String(loan.amount) : '',
      type: loan.type || 'Personal',
      interest: loan.interest != null ? String(loan.interest) : '',
      tenure: loan.tenure != null ? String(loan.tenure) : '',
      status: loan.status || DEFAULT_LOAN_STATUS,
    });
    setShowModal(true);
  };

  const handleStatusChange = async (loan, nextStatus) => {
    const previousStatus = loan.status || DEFAULT_LOAN_STATUS;
    if (previousStatus === nextStatus) {
      return;
    }

    try {
      const updatedLoan = await updateLoanRecord(loan.id, { status: nextStatus });
      const nextLoans = loans.map((item) => (
        item.id === loan.id ? updatedLoan : item
      ));
      persistLoans(nextLoans);
      showToast(`Loan ${formatLoanDisplayId(loan)} moved to ${nextStatus}`, loan.id, previousStatus);

      recordActivitySafely({
        type: 'loan_status_changed',
        actor: user?.username || 'system',
        message: `Loan ${formatLoanDisplayId(loan)} status changed to ${nextStatus}`,
        meta: { loanId: loan.id, status: nextStatus },
      });
    } catch (error) {
      setPageError(error.message || 'Failed to update loan status.');
    }
  };

  const undoStatusChange = async () => {
    if (!toast.loanId) {
      return;
    }

    if (toast.action === 'delete' && toast.entry) {
      try {
        const restoredLoan = await restoreDeletedEntry(toast.entry);
        persistLoans([restoredLoan, ...loans]);
        recordActivitySafely({
          type: 'loan_deleted_undo',
          actor: user?.username || 'system',
          message: 'Loan restored',
          meta: { loanId: toast.loanId },
        });
      } catch (error) {
        setPageError(error.message || 'Failed to restore loan.');
      } finally {
        clearToast();
      }
      return;
    }

    if (toast.action === 'status' && toast.prevStatus != null) {
      try {
        const revertedLoan = await updateLoanRecord(toast.loanId, { status: toast.prevStatus });
        persistLoans(loans.map((loan) => (
          loan.id === toast.loanId ? revertedLoan : loan
        )));

        recordActivitySafely({
          type: 'loan_status_undo',
          actor: user?.username || 'system',
          message: `Loan status reverted to ${toast.prevStatus}`,
          meta: { loanId: toast.loanId, status: toast.prevStatus },
        });
      } catch (error) {
        setPageError(error.message || 'Failed to revert loan status.');
      } finally {
        clearToast();
      }
    }
  };

  const handleDeleteLoan = async (loan) => {
    if (!canDelete) {
      setPageError('Only superusers can delete loans.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Loan ${formatLoanDisplayId(loan)}?`)) {
      return;
    }

    try {
      await deleteLoanRecord(loan.id);
      const recycleEntry = addToRecycleBin({ entityType: 'loans', item: loan });
      persistLoans(loans.filter((item) => item.id !== loan.id));
      showToast(`Loan ${formatLoanDisplayId(loan)} moved to recycle bin`, loan.id, null, 'delete', recycleEntry);

      recordActivitySafely({
        type: 'loan_deleted',
        actor: user?.username || 'system',
        message: `Loan ${formatLoanDisplayId(loan)} moved to recycle bin`,
        meta: { loanId: loan.id },
      });
    } catch (error) {
      setPageError(error.message || 'Failed to delete loan.');
    }
  };

  return (
    <div className="loans-page">
      <div className="page-header">
        <div>
          <h1>Loans Management</h1>
          {statusFilter !== 'all' ? (
            <p style={{ margin: '6px 0 0', color: '#64748b' }}>Showing loans in {statusFilter}</p>
          ) : null}
        </div>
        <button className="btn-primary" onClick={openCreateModal}>
          + New Loan
        </button>
      </div>

      {pageError ? <div className="error-message">{pageError}</div> : null}

      <div className="filters">
        <input
          type="text"
          placeholder="Search by loan ID, customer, lender, refference, or date..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <input
          type="date"
          value={createdFrom}
          onChange={(e) => setCreatedFrom(e.target.value)}
          className="filter-input"
          aria-label="Created from"
        />
        <input
          type="date"
          value={createdTo}
          onChange={(e) => setCreatedTo(e.target.value)}
          className="filter-input"
          aria-label="Created to"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          {LOAN_STATUS_FLOW.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="loans-table-container">
        <table className="loans-table">
          <thead>
            <tr>
              <th>Loan ID</th>
              <th>Customer</th>
              <th>Lender Name</th>
              <th>Refference Name</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Interest</th>
              <th>Tenure</th>
              <th>Status</th>
              <th>Created At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadingLoans ? (
              <tr>
                <td colSpan="11">Loading loans from the server...</td>
              </tr>
            ) : filteredLoans.map((loan) => (
              <tr key={loan.id}>
                <td>{formatLoanDisplayId(loan)}</td>
                <td>
                  {loan.customerId ? (
                    <Link to={`/customers/${loan.customerId}`} className="customer-link">
                      {loan.customer}
                    </Link>
                  ) : (
                    <span>{loan.customer}</span>
                  )}
                </td>
                <td>{loan.lenderName || '-'}</td>
                <td>{loan.referenceName || '-'}</td>
                <td>{loan.type}</td>
                <td>Rs. {loan.amount.toLocaleString()}</td>
                <td>{loan.interest}%</td>
                <td>{formatTenureYears(loan.tenure)}</td>
                <td>
                  <select
                    className="status-select"
                    value={loan.status || DEFAULT_LOAN_STATUS}
                    onChange={(e) => handleStatusChange(loan, e.target.value)}
                  >
                    {LOAN_STATUS_FLOW.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </td>
                <td>{formatLoanCreatedAt(loan)}</td>
                <td>
                  <div className="action-buttons">
                    <Link to={`/loans/${loan.id}`} className="btn-view">View</Link>
                    <button className="btn-edit" onClick={() => handleEditClick(loan)}>Edit</button>
                    {canDelete ? (
                      <button className="btn-delete" onClick={() => handleDeleteLoan(loan)}>Delete</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast.visible ? (
        <div className="toast" role="status">
          <div className="toast-message">{toast.message}</div>
          <div className="toast-actions">
            <button type="button" className="btn-secondary" onClick={undoStatusChange}>Undo</button>
            <button type="button" className="btn-secondary" onClick={clearToast} style={{ marginLeft: 8 }}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {showModal ? (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingLoanId ? 'Edit Loan' : 'Create New Loan'}</h2>
              <button className="modal-close" onClick={closeModal}>x</button>
            </div>
            <form onSubmit={handleSaveLoan}>
              {formError ? <div className="modal-error-message">{formError}</div> : null}
              <div className="form-group">
                <label>Customer Name</label>
                <CustomerSelect
                  mode="input"
                  valueId={newLoan.customerId}
                  valueName={newLoan.customer}
                  onChange={({ customerId, customerName }) => {
                    setFormError('');
                    setNewLoan({
                      ...newLoan,
                      customerId: customerId ? String(customerId) : '',
                      customer: customerName,
                    });
                  }}
                  placeholder="Search and select an existing customer"
                  required
                />
                <div className="field-hint">Choose the customer from the suggestions so the loan links to the correct record.</div>
              </div>

              <div className="form-group">
                <label>Manual Loan ID</label>
                <input
                  type="text"
                  value={newLoan.loanId}
                  onChange={(e) => {
                    setFormError('');
                    setNewLoan({ ...newLoan, loanId: e.target.value });
                  }}
                  placeholder="Enter manual loan ID"
                  required
                />
                <div className="field-hint">
                  This manual loan ID can be changed later. The system record ID stays saved automatically in the background.
                </div>
              </div>

              <div className="form-group">
                <label>System Record ID</label>
                <input
                  type="text"
                  value={editingLoanId || 'Will be created automatically after saving this loan'}
                  readOnly
                />
                <div className="field-hint">
                  This internal system ID is kept separately, even if the manual loan ID is edited later.
                </div>
              </div>

              <div className="form-group">
                <label>Lender Name (Bank Name)</label>
                <input
                  type="text"
                  value={newLoan.lenderName}
                  onChange={(e) => setNewLoan({ ...newLoan, lenderName: e.target.value })}
                  placeholder="Type lender / bank name"
                  required
                />
              </div>

              <div className="form-group">
                <label>Refference Name</label>
                <input
                  type="text"
                  value={newLoan.referenceName}
                  onChange={(e) => setNewLoan({ ...newLoan, referenceName: e.target.value })}
                  placeholder="Type refference name"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Loan Amount</label>
                  <input
                    type="number"
                    value={newLoan.amount}
                    onChange={(e) => setNewLoan({ ...newLoan, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Loan Type</label>
                  <select
                    value={newLoan.type}
                    onChange={(e) => setNewLoan({ ...newLoan, type: e.target.value })}
                  >
                    <option value="Personal">Personal</option>
                    <option value="Home">Home</option>
                    <option value="Vehicle">Vehicle</option>
                    <option value="Business">Business</option>
                    <option value="Education">Education</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Interest Rate (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newLoan.interest}
                    onChange={(e) => setNewLoan({ ...newLoan, interest: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Tenure (years)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={newLoan.tenure}
                    onChange={(e) => setNewLoan({ ...newLoan, tenure: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Status</label>
                <select
                  value={newLoan.status || DEFAULT_LOAN_STATUS}
                  onChange={(e) => setNewLoan({ ...newLoan, status: e.target.value })}
                >
                  {LOAN_STATUS_FLOW.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingLoanId ? 'Save Changes' : 'Create Loan')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Loans;

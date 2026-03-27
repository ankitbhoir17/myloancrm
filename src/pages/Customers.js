import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addActivity } from '../utils/activities';
import { addToRecycleBin } from '../utils/recycleBin';
import { restoreDeletedEntry } from '../utils/recycleBinApi';
import {
  createCustomerRecord,
  deleteCustomerRecord,
  readCachedCustomers,
  syncCustomersCache,
  updateCustomerRecord,
  writeCachedCustomers,
} from '../utils/crmData';
import './Customers.css';

const emptyCustomerForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  status: 'Active',
};

function recordActivitySafely(payload) {
  try {
    addActivity(payload);
  } catch (error) {
    // Ignore activity failures to keep customer actions responsive.
  }
}

function Customers() {
  const [customers, setCustomers] = useState(() => readCachedCustomers());
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [pageError, setPageError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [newCustomer, setNewCustomer] = useState(emptyCustomerForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', customerId: null, action: null, entry: null });
  const toastTimerRef = useRef(null);

  const { user } = useAuth();
  const canDelete = user?.role === 'superuser';

  useEffect(() => {
    let isMounted = true;

    const loadCustomers = async () => {
      try {
        setLoadingCustomers(true);
        setPageError('');
        const nextCustomers = await syncCustomersCache();
        if (isMounted) {
          setCustomers(nextCustomers);
        }
      } catch (error) {
        if (isMounted) {
          setCustomers(readCachedCustomers());
          setPageError(error.message || 'Failed to load customers from the server.');
        }
      } finally {
        if (isMounted) {
          setLoadingCustomers(false);
        }
      }
    };

    loadCustomers();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCustomers = customers.filter((customer) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = customer.name.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query) ||
      customer.phone.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || customer.status.toLowerCase() === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const clearToast = () => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast({ visible: false, message: '', customerId: null, action: null, entry: null });
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (message, customerId, action = 'info', entry = null) => {
    clearToast();
    setToast({ visible: true, message, customerId, action, entry });
    toastTimerRef.current = setTimeout(() => {
      clearToast();
    }, 5000);
  };

  const closeCustomerModal = () => {
    setShowModal(false);
    setEditingCustomerId(null);
    setNewCustomer(emptyCustomerForm);
    setSaving(false);
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      let nextCustomers = customers;

      if (editingCustomerId) {
        const updatedCustomer = await updateCustomerRecord(editingCustomerId, newCustomer);
        nextCustomers = customers.map((customer) => (
          customer.id === editingCustomerId ? updatedCustomer : customer
        ));

        recordActivitySafely({
          type: 'customer_updated',
          actor: user?.username || 'system',
          message: `${updatedCustomer.name} updated`,
          meta: { customerId: updatedCustomer.id },
        });

        showToast(`Customer ${updatedCustomer.name} updated`, updatedCustomer.id, 'info');
      } else {
        const customerToAdd = await createCustomerRecord(newCustomer);
        nextCustomers = [customerToAdd, ...customers];

        recordActivitySafely({
          type: 'customer_created',
          actor: user?.username || 'system',
          message: `${customerToAdd.name} added`,
          meta: { customerId: customerToAdd.id },
        });

        showToast(`Customer ${customerToAdd.name} added`, customerToAdd.id, 'info');
      }

      setCustomers(nextCustomers);
      writeCachedCustomers(nextCustomers);
      closeCustomerModal();
    } catch (error) {
      setPageError(error.message || 'Failed to save customer.');
      setSaving(false);
    }
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomerId(customer.id);
    setNewCustomer({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      status: customer.status || 'Active',
    });
    setShowModal(true);
  };

  const handleDeleteCustomer = async (customer) => {
    if (!canDelete) {
      setPageError('Only superusers can delete customers.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${customer.name}?`)) {
      return;
    }

    try {
      await deleteCustomerRecord(customer.id);
      const nextCustomers = customers.filter((item) => item.id !== customer.id);
      const recycleEntry = addToRecycleBin({ entityType: 'customers', item: customer });
      setCustomers(nextCustomers);
      writeCachedCustomers(nextCustomers);
      showToast(`Customer ${customer.name} moved to recycle bin`, customer.id, 'delete', recycleEntry);

      recordActivitySafely({
        type: 'customer_deleted',
        actor: user?.username || 'system',
        message: `${customer.name} moved to recycle bin`,
        meta: { customerId: customer.id },
      });
    } catch (error) {
      setPageError(error.message || 'Failed to delete customer.');
    }
  };

  const undoDeleteCustomer = async () => {
    if (toast.action !== 'delete' || !toast.entry) {
      return;
    }

    try {
      const restoredCustomer = await restoreDeletedEntry(toast.entry);
      const nextCustomers = [restoredCustomer, ...customers];
      setCustomers(nextCustomers);
      writeCachedCustomers(nextCustomers);

      recordActivitySafely({
        type: 'customer_deleted_undo',
        actor: user?.username || 'system',
        message: `${restoredCustomer.name} restored`,
        meta: { customerId: restoredCustomer.id },
      });

      clearToast();
    } catch (error) {
      setPageError(error.message || 'Failed to restore customer.');
      clearToast();
    }
  };

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1>Customers Management</h1>
        <button className="btn-primary" onClick={() => { setEditingCustomerId(null); setNewCustomer(emptyCustomerForm); setShowModal(true); }}>
          + Add Customer
        </button>
      </div>

      {pageError ? <div className="error-message">{pageError}</div> : null}

      <div className="filters">
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="customers-grid">
        {loadingCustomers ? (
          <div className="customer-card full-width">
            <p className="muted">Loading customers from the server...</p>
          </div>
        ) : filteredCustomers.map((customer) => (
          <div key={customer.id} className="customer-card">
            <div className="customer-header">
              <div className="customer-avatar">
                {customer.name.split(' ').map((namePart) => namePart[0]).join('')}
              </div>
              <div className="customer-info">
                <h3>{customer.name}</h3>
                <span className={`status-badge status-${customer.status.toLowerCase()}`}>
                  {customer.status}
                </span>
              </div>
            </div>
            <div className="customer-details">
              <div className="detail-item">
                <span className="detail-icon">📧</span>
                <span>{customer.email}</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">📱</span>
                <span>{customer.phone}</span>
              </div>
              <div className="detail-item">
                <span className="detail-icon">📅</span>
                <span>Joined: {customer.joinDate}</span>
              </div>
            </div>
            <div className="customer-stats">
              <div className="stat">
                <span className="stat-value">{customer.loanCount}</span>
                <span className="stat-label">Loans</span>
              </div>
              <div className="stat">
                <span className="stat-value">₹{customer.totalAmount.toLocaleString()}</span>
                <span className="stat-label">Total Amount</span>
              </div>
            </div>
            <div className="customer-actions">
              <Link to={`/customers/${customer.id}`} className="btn-view">View Profile</Link>
              <button className="btn-edit" onClick={() => handleEditCustomer(customer)}>Edit</button>
              {canDelete ? (
                <button className="btn-delete" onClick={() => handleDeleteCustomer(customer)}>Delete</button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {toast.visible && (
        <div className="toast" role="status" style={{ marginBottom: '12px' }}>
          <div className="toast-message">{toast.message}</div>
          <div className="toast-actions">
            {toast.action === 'delete' && (
              <button type="button" className="btn-secondary" onClick={undoDeleteCustomer}>Undo</button>
            )}
            <button type="button" className="btn-secondary" onClick={clearToast} style={{ marginLeft: toast.action === 'delete' ? 8 : 0 }}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeCustomerModal}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingCustomerId ? 'Edit Customer' : 'Add New Customer'}</h2>
              <button className="modal-close" onClick={closeCustomerModal}>×</button>
            </div>
            <form onSubmit={handleSaveCustomer}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  value={newCustomer.address}
                  onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                  rows="3"
                ></textarea>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={newCustomer.status}
                  onChange={(e) => setNewCustomer({ ...newCustomer, status: e.target.value })}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeCustomerModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingCustomerId ? 'Update Customer' : 'Add Customer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;

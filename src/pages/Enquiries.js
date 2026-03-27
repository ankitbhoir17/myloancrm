import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addActivity } from '../utils/activities';
import { readCachedCustomers } from '../utils/crmData';
import {
  createEnquiryRecord,
  deleteEnquiryRecord,
  readCachedEnquiries,
  syncEnquiriesCache,
  updateEnquiryRecord,
  writeCachedEnquiries,
} from '../utils/enquiriesData';
import { addToRecycleBin } from '../utils/recycleBin';
import CustomerSelect from '../components/CustomerSelect';
import './Customers.css';

function Enquiries() {
  const [customers, setCustomers] = useState(() => readCachedCustomers());
  const [enquiries, setEnquiries] = useState(() => readCachedEnquiries());
  const [loadingEnquiries, setLoadingEnquiries] = useState(true);
  const [pageError, setPageError] = useState('');
  const [enquiryForm, setEnquiryForm] = useState({
    customerId: '',
    customerName: '',
    email: '',
    phone: '',
    message: '',
  });

  const { user } = useAuth();
  const canDelete = user?.role === 'superuser';

  useEffect(() => {
    let mounted = true;

    const loadEnquiries = async () => {
      try {
        setLoadingEnquiries(true);
        setPageError('');
        const nextEnquiries = await syncEnquiriesCache();
        if (mounted) {
          setEnquiries(nextEnquiries);
        }
      } catch (error) {
        if (mounted) {
          setEnquiries(readCachedEnquiries());
          setPageError(error.message || 'Failed to load enquiries.');
        }
      } finally {
        if (mounted) {
          setLoadingEnquiries(false);
        }
      }
    };

    loadEnquiries();

    const syncData = (event) => {
      const key = event?.detail?.key || event?.key;
      if (!key || key === 'customers') {
        setCustomers(readCachedCustomers());
      }
      if (!key || key === 'enquiries') {
        setEnquiries(readCachedEnquiries());
      }
    };

    window.addEventListener('storage', syncData);
    window.addEventListener('app:storage-changed', syncData);

    return () => {
      mounted = false;
      window.removeEventListener('storage', syncData);
      window.removeEventListener('app:storage-changed', syncData);
    };
  }, []);

  const handleCreateEnquiry = async (event) => {
    event.preventDefault();
    setPageError('');

    const matchedCustomer = enquiryForm.customerId
      ? customers.find((customer) => String(customer.id) === String(enquiryForm.customerId))
      : null;

    try {
      const enquiryToAdd = await createEnquiryRecord({
        customerId: enquiryForm.customerId || null,
        customerName: matchedCustomer?.name || enquiryForm.customerName,
        email: enquiryForm.email,
        phone: enquiryForm.phone,
        message: enquiryForm.message,
        status: 'New',
      });

      const nextEnquiries = [enquiryToAdd, ...enquiries];
      setEnquiries(nextEnquiries);
      writeCachedEnquiries(nextEnquiries);

      try {
        addActivity({
          type: 'enquiry_created',
          actor: user?.username || 'system',
          message: `Enquiry ${enquiryToAdd.id} created by ${user?.username || 'guest'}`,
          meta: { enquiryId: enquiryToAdd.id },
        });
      } catch (error) {
        // Ignore activity logging failures to keep enquiry creation responsive.
      }

      setEnquiryForm({ customerId: '', customerName: '', email: '', phone: '', message: '' });
    } catch (error) {
      setPageError(error.message || 'Failed to create enquiry.');
    }
  };

  const handleResolveEnquiry = async (enquiry) => {
    const nextStatus = enquiry.status === 'New' ? 'Resolved' : 'New';
    setPageError('');

    try {
      const updatedEnquiry = await updateEnquiryRecord(enquiry.id, { status: nextStatus });
      const nextEnquiries = enquiries.map((item) => (
        item.id === enquiry.id ? updatedEnquiry : item
      ));
      setEnquiries(nextEnquiries);
      writeCachedEnquiries(nextEnquiries);

      try {
        addActivity({
          type: 'enquiry_status',
          actor: user?.username || 'system',
          message: `Enquiry ${enquiry.id} marked ${nextStatus}`,
          meta: { enquiryId: enquiry.id, status: nextStatus },
        });
      } catch (error) {
        // Ignore activity logging failures to keep enquiry actions responsive.
      }
    } catch (error) {
      setPageError(error.message || 'Failed to update enquiry status.');
    }
  };

  const handleDeleteEnquiry = async (enquiry) => {
    if (!canDelete) {
      setPageError('Only superusers can delete enquiries.');
      return;
    }

    setPageError('');

    try {
      await deleteEnquiryRecord(enquiry.id);
      addToRecycleBin({ entityType: 'enquiries', item: enquiry });
      const nextEnquiries = enquiries.filter((item) => item.id !== enquiry.id);
      setEnquiries(nextEnquiries);
      writeCachedEnquiries(nextEnquiries);

      try {
        addActivity({
          type: 'enquiry_deleted',
          actor: user?.username || 'system',
          message: `Enquiry ${enquiry.id} moved to recycle bin`,
          meta: { enquiryId: enquiry.id },
        });
      } catch (error) {
        // Ignore activity logging failures to keep enquiry deletion responsive.
      }
    } catch (error) {
      setPageError(error.message || 'Failed to delete enquiry.');
    }
  };

  return (
    <div className="enquiries-page">
      <div className="page-header">
        <h1>Enquiries</h1>
      </div>

      {pageError ? <div className="error-message">{pageError}</div> : null}

      <div className="enquiry-form">
        <form onSubmit={handleCreateEnquiry}>
          <div className="form-row">
            <div className="form-group">
              <label>Existing Customer</label>
              <CustomerSelect
                mode="select"
                valueId={enquiryForm.customerId}
                onChange={({ customerId, customerName }) => {
                  if (!customerId) {
                    setEnquiryForm({
                      ...enquiryForm,
                      customerId: '',
                      customerName: '',
                      email: '',
                      phone: '',
                    });
                    return;
                  }

                  const matched = customers.find((customer) => String(customer.id) === String(customerId));
                  setEnquiryForm({
                    ...enquiryForm,
                    customerId: String(customerId),
                    customerName: matched?.name || customerName || '',
                    email: matched?.email || '',
                    phone: matched?.phone || '',
                  });
                }}
              />
            </div>
            <div className="form-group">
              <label>Customer Name (if not selected)</label>
              <input
                type="text"
                value={enquiryForm.customerName}
                onChange={(event) => setEnquiryForm({ ...enquiryForm, customerName: event.target.value })}
                placeholder="Name"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={enquiryForm.email}
                onChange={(event) => setEnquiryForm({ ...enquiryForm, email: event.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="tel"
                value={enquiryForm.phone}
                onChange={(event) => setEnquiryForm({ ...enquiryForm, phone: event.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Message</label>
            <textarea
              value={enquiryForm.message}
              onChange={(event) => setEnquiryForm({ ...enquiryForm, message: event.target.value })}
              rows="3"
              required
            />
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn-primary">Add Enquiry</button>
          </div>
        </form>
      </div>

      <div className="enquiries-list">
        {loadingEnquiries ? (
          <p className="muted">Loading enquiries...</p>
        ) : enquiries.length === 0 ? (
          <p className="muted">No enquiries yet.</p>
        ) : (
          enquiries.map((enquiry) => (
            <div key={enquiry.id} className="enquiry-card">
              <div className="enquiry-row">
                <div>
                  <strong>{enquiry.customerName || 'Guest'}</strong>
                  <div className="muted">
                    {enquiry.email}
                    {enquiry.email && enquiry.phone ? ' / ' : ''}
                    {enquiry.phone}
                  </div>
                </div>
                <div className="enquiry-meta">
                  <span className={`status-badge status-${enquiry.status.toLowerCase()}`}>{enquiry.status}</span>
                  <span className="muted">{enquiry.date}</span>
                </div>
              </div>
              <div className="enquiry-message">{enquiry.message}</div>
              <div className="enquiry-actions">
                <button className="btn-secondary" onClick={() => handleResolveEnquiry(enquiry)}>
                  {enquiry.status === 'New' ? 'Resolve' : 'Reopen'}
                </button>
                {canDelete ? (
                  <button className="btn-danger" onClick={() => handleDeleteEnquiry(enquiry)}>Delete</button>
                ) : null}
                {enquiry.customerId ? (
                  <Link to={`/customers/${enquiry.customerId}`} className="action-link">View Customer</Link>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Enquiries;

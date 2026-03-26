import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { addActivity } from '../utils/activities';
import { readCachedCustomers } from '../utils/crmData';
import { addToRecycleBin, getNextEntityId } from '../utils/recycleBin';
import CustomerSelect from '../components/CustomerSelect';
import './Customers.css';

function Enquiries() {
  const [customers, setCustomers] = useState(() => readCachedCustomers());
  const [enquiries, setEnquiries] = useState(() => {
    try {
      const saved = localStorage.getItem('enquiries');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      return [];
    }
  });

  const [enquiryForm, setEnquiryForm] = useState({
    customerId: '',
    customerName: '',
    email: '',
    phone: '',
    message: '',
  });

  const { user } = useAuth();

  useEffect(() => {
    const syncCustomers = () => {
      setCustomers(readCachedCustomers());
    };

    window.addEventListener('storage', syncCustomers);
    window.addEventListener('app:storage-changed', syncCustomers);

    return () => {
      window.removeEventListener('storage', syncCustomers);
      window.removeEventListener('app:storage-changed', syncCustomers);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('enquiries', JSON.stringify(enquiries));
    } catch (error) {
      console.error('Failed saving enquiries to localStorage', error);
    }
  }, [enquiries]);

  const handleCreateEnquiry = (event) => {
    event.preventDefault();
    const nextId = getNextEntityId('enquiries', enquiries);
    const today = new Date().toISOString().slice(0, 10);
    const matchedCustomer = enquiryForm.customerId
      ? customers.find((customer) => String(customer.id) === String(enquiryForm.customerId))
      : null;

    const enquiryToAdd = {
      id: nextId,
      customerId: enquiryForm.customerId || null,
      customerName: matchedCustomer?.name || enquiryForm.customerName,
      email: enquiryForm.email,
      phone: enquiryForm.phone,
      message: enquiryForm.message,
      status: 'New',
      date: today,
    };

    setEnquiries((previous) => [enquiryToAdd, ...previous]);
    try {
      addActivity({
        type: 'enquiry_created',
        actor: user?.username || 'system',
        message: `Enquiry #${nextId} created by ${user?.username || 'guest'}`,
        meta: { enquiryId: nextId },
      });
    } catch (error) {
      // Ignore activity logging failures to keep enquiry creation responsive.
    }
    setEnquiryForm({ customerId: '', customerName: '', email: '', phone: '', message: '' });
  };

  const handleResolveEnquiry = (id) => {
    setEnquiries((previous) => previous.map((enquiry) => {
      if (enquiry.id === id) {
        const nextStatus = enquiry.status === 'New' ? 'Resolved' : 'New';
        try {
          addActivity({
            type: 'enquiry_status',
            actor: user?.username || 'system',
            message: `Enquiry #${id} marked ${nextStatus}`,
            meta: { enquiryId: id, status: nextStatus },
          });
        } catch (error) {
          // Ignore activity logging failures to keep enquiry actions responsive.
        }
        return { ...enquiry, status: nextStatus };
      }
      return enquiry;
    }));
  };

  const handleDeleteEnquiry = (id) => {
    const targetEnquiry = enquiries.find((item) => item.id === id);
    if (!targetEnquiry) {
      return;
    }

    addToRecycleBin({ entityType: 'enquiries', item: targetEnquiry });
    setEnquiries((previous) => previous.filter((item) => item.id !== id));
    try {
      addActivity({
        type: 'enquiry_deleted',
        actor: user?.username || 'system',
        message: `Enquiry #${id} moved to recycle bin`,
        meta: { enquiryId: id },
      });
    } catch (error) {
      // Ignore activity logging failures to keep enquiry deletion responsive.
    }
  };

  return (
    <div className="enquiries-page">
      <div className="page-header">
        <h1>Enquiries</h1>
      </div>

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
        {enquiries.length === 0 ? (
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
                <button className="btn-secondary" onClick={() => handleResolveEnquiry(enquiry.id)}>
                  {enquiry.status === 'New' ? 'Resolve' : 'Reopen'}
                </button>
                <button className="btn-danger" onClick={() => handleDeleteEnquiry(enquiry.id)}>Delete</button>
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

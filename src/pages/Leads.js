import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addActivity } from '../utils/activities';
import { addToRecycleBin } from '../utils/recycleBin';
import {
  createLeadRecord,
  createManyLeadRecords,
  deleteLeadRecord,
  readCachedLeads,
  syncLeadsCache,
  updateLeadRecord,
  writeCachedLeads,
} from '../utils/leadsData';
import './Customers.css';

const emptyLeadForm = {
  businessName: '',
  businessEntity: '',
  contactPerson: '',
  primaryPhone: '',
  city: '',
  sourcedBy: '',
  loanType: 'Business Loans',
  status: 'New',
};

function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState(() => readCachedLeads());
  const [loadingLeads, setLoadingLeads] = useState(true);
  const [pageError, setPageError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState(null);
  const [form, setForm] = useState(emptyLeadForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [typeTab, setTypeTab] = useState('Business Loans');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadLeads = async () => {
      try {
        setLoadingLeads(true);
        setPageError('');
        const nextLeads = await syncLeadsCache();
        if (mounted) {
          setLeads(nextLeads);
        }
      } catch (error) {
        if (mounted) {
          setLeads(readCachedLeads());
          setPageError(error.message || 'Failed to load leads.');
        }
      } finally {
        if (mounted) {
          setLoadingLeads(false);
        }
      }
    };

    loadLeads();

    const syncData = (event) => {
      const key = event?.detail?.key || event?.key;
      if (!key || key === 'leads') {
        setLeads(readCachedLeads());
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

  const persistLeads = (nextLeads) => {
    setLeads(nextLeads);
    writeCachedLeads(nextLeads);
  };

  const closeModal = () => {
    setShowCreate(false);
    setEditingLeadId(null);
    setForm(emptyLeadForm);
    setSaving(false);
  };

  const handleSaveLead = async (event) => {
    event.preventDefault();
    setSaving(true);
    setPageError('');

    const payload = {
      businessName: form.businessName,
      businessEntity: form.businessEntity,
      contactPerson: form.contactPerson,
      primaryPhone: form.primaryPhone,
      city: form.city,
      sourcedBy: form.sourcedBy,
      loanType: form.loanType,
      status: form.status,
    };

    try {
      let nextLeads = leads;

      if (editingLeadId) {
        const updatedLead = await updateLeadRecord(editingLeadId, payload);
        nextLeads = leads.map((lead) => (
          lead.id === editingLeadId ? updatedLead : lead
        ));

        try {
          addActivity({
            type: 'lead_updated',
            actor: user?.username || 'system',
            message: `Lead ${updatedLead.businessName} updated`,
            meta: { leadId: updatedLead.id },
          });
        } catch (error) {
          // Ignore activity logging failures.
        }
      } else {
        const createdLead = await createLeadRecord(payload);
        nextLeads = [createdLead, ...leads];

        try {
          addActivity({
            type: 'lead_created',
            actor: user?.username || 'system',
            message: `Lead ${createdLead.businessName} created`,
            meta: { leadId: createdLead.id },
          });
        } catch (error) {
          // Ignore activity logging failures.
        }
      }

      persistLeads(nextLeads);
      closeModal();
    } catch (error) {
      setPageError(error.message || 'Failed to save lead.');
      setSaving(false);
    }
  };

  const handleEdit = (lead) => {
    setEditingLeadId(lead.id);
    setForm({
      businessName: lead.businessName || '',
      businessEntity: lead.businessEntity || '',
      contactPerson: lead.contactPerson || '',
      primaryPhone: lead.primaryPhone || '',
      city: lead.city || '',
      sourcedBy: lead.sourcedBy || '',
      loanType: lead.loanType || 'Business Loans',
      status: lead.status || 'New',
    });
    setShowCreate(true);
  };

  const handleDelete = async (lead) => {
    if (!window.confirm(`Delete lead ${lead.businessName}?`)) {
      return;
    }

    setPageError('');

    try {
      await deleteLeadRecord(lead.id);
      addToRecycleBin({ entityType: 'leads', item: lead });
      persistLeads(leads.filter((item) => item.id !== lead.id));

      try {
        addActivity({
          type: 'lead_deleted',
          actor: user?.username || 'system',
          message: `Lead ${lead.businessName} moved to recycle bin`,
          meta: { leadId: lead.id },
        });
      } catch (error) {
        // Ignore activity logging failures.
      }
    } catch (error) {
      setPageError(error.message || 'Failed to delete lead.');
    }
  };

  const tabs = ['Business Loans', 'Personal Loans', 'Home Loans', 'Mortgage Loans'];

  const counts = tabs.reduce((acc, tab) => {
    acc[tab] = leads.filter((lead) => (lead.loanType || 'Business Loans') === tab).length;
    return acc;
  }, {});

  const filtered = leads.filter((lead) => {
    if (typeTab && (lead.loanType || 'Business Loans') !== typeTab) {
      return false;
    }
    if (statusFilter !== 'All' && (lead.status || 'New') !== statusFilter) {
      return false;
    }
    if (!search) {
      return true;
    }
    const query = search.toLowerCase();
    return [
      lead.businessName,
      lead.contactPerson,
      lead.primaryPhone,
      lead.city,
      lead.sourcedBy,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const sorted = useMemo(() => {
    if (!sortKey) {
      return filtered;
    }

    const next = filtered.slice();
    next.sort((left, right) => {
      const a = (left[sortKey] || '').toString().toLowerCase();
      const b = (right[sortKey] || '').toString().toLowerCase();
      if (a < b) {
        return sortDir === 'asc' ? -1 : 1;
      }
      if (a > b) {
        return sortDir === 'asc' ? 1 : -1;
      }
      return 0;
    });
    return next;
  }, [filtered, sortDir, sortKey]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(key);
    setSortDir('asc');
  };

  const handleBulkClick = () => fileInputRef.current?.click();

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) {
      return [];
    }

    const headers = lines[0].split(',').map((header) => header.trim());
    return lines.slice(1).map((line) => {
      const parts = line.split(',').map((part) => part.trim());
      const row = {};
      headers.forEach((header, index) => {
        row[header] = parts[index] || '';
      });
      return row;
    });
  };

  const handleFile = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        setPageError('');
        const rows = parseCSV(String(loadEvent.target?.result || ''));
        if (rows.length === 0) {
          event.target.value = '';
          return;
        }

        const payload = rows.map((row) => ({
          businessName: row['Business Name'] || row.businessName || row.Business || row.business || '',
          businessEntity: row['Business Entity'] || row.businessEntity || '',
          contactPerson: row['Contact Person'] || row.contactPerson || row.Contact || '',
          primaryPhone: row['Primary Phone'] || row.Phone || row.phone || '',
          city: row.City || row.city || '',
          sourcedBy: row['Sourced By'] || row.sourcedBy || '',
          createdDate: row['Created Date'] || '',
          status: row.Status || 'New',
          loanType: row['Loan Type'] || 'Business Loans',
        }));

        const createdLeads = await createManyLeadRecords(payload);
        persistLeads([...createdLeads, ...leads]);

        try {
          addActivity({
            type: 'leads_bulk_upload',
            actor: user?.username || 'system',
            message: `Bulk uploaded ${createdLeads.length} leads`,
            meta: { count: createdLeads.length },
          });
        } catch (error) {
          // Ignore activity logging failures.
        }
      } catch (error) {
        setPageError(error.message || 'Failed to upload leads.');
      } finally {
        event.target.value = '';
      }
    };

    reader.readAsText(file);
  };

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1>Leads</h1>
      </div>

      {pageError ? <div className="error-message">{pageError}</div> : null}

      <div className="customer-card full-width" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setTypeTab(tab)}
                className={`btn-secondary ${typeTab === tab ? 'active' : ''}`}
                style={typeTab === tab ? { background: '#5b4fcf', color: 'white' } : {}}
              >
                {tab} ({counts[tab] || 0})
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={handleBulkClick}>Bulk Upload</button>
            <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFile} />
            <button className="btn-primary" onClick={() => setShowCreate(true)}>Add Lead</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center' }}>
          <input
            placeholder="Search by business name, contact, or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="search-input"
            style={{ flex: 1 }}
          />
          <select className="filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All</option>
            <option value="New">New Leads</option>
            <option value="Contacted">Contacted</option>
          </select>
        </div>

        {showCreate ? (
          <div style={{ marginTop: 12 }}>
            <form onSubmit={handleSaveLead}>
              <div className="form-row">
                <div className="form-group">
                  <label>Business Name</label>
                  <input value={form.businessName} onChange={(event) => setForm({ ...form, businessName: event.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Business Entity</label>
                  <input value={form.businessEntity} onChange={(event) => setForm({ ...form, businessEntity: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input value={form.contactPerson} onChange={(event) => setForm({ ...form, contactPerson: event.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Primary Phone</label>
                  <input value={form.primaryPhone} onChange={(event) => setForm({ ...form, primaryPhone: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>City</label>
                  <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Sourced By</label>
                  <input value={form.sourcedBy} onChange={(event) => setForm({ ...form, sourcedBy: event.target.value })} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Loan Type</label>
                  <select value={form.loanType} onChange={(event) => setForm({ ...form, loanType: event.target.value })}>
                    {tabs.map((tab) => <option key={tab} value={tab}>{tab}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    <option value="New">New</option>
                    <option value="Contacted">Contacted</option>
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 8 }} className="modal-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : editingLeadId ? 'Save Lead' : 'Add Lead'}
                </button>
                <button type="button" className="btn-secondary" onClick={closeModal} style={{ marginLeft: 8 }}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('id')} style={{ cursor: 'pointer' }}>Lead ID {sortKey === 'id' ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
                <th onClick={() => toggleSort('businessName')} style={{ cursor: 'pointer' }}>Business Name {sortKey === 'businessName' ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
                <th onClick={() => toggleSort('businessEntity')} style={{ cursor: 'pointer' }}>Business Entity {sortKey === 'businessEntity' ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
                <th onClick={() => toggleSort('contactPerson')} style={{ cursor: 'pointer' }}>Contact Person {sortKey === 'contactPerson' ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
                <th onClick={() => toggleSort('primaryPhone')} style={{ cursor: 'pointer' }}>Primary Phone {sortKey === 'primaryPhone' ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
                <th onClick={() => toggleSort('city')} style={{ cursor: 'pointer' }}>City {sortKey === 'city' ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
                <th onClick={() => toggleSort('sourcedBy')} style={{ cursor: 'pointer' }}>Sourced By {sortKey === 'sourcedBy' ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
                <th onClick={() => toggleSort('createdDate')} style={{ cursor: 'pointer' }}>Created Date {sortKey === 'createdDate' ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
                <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer' }}>Status {sortKey === 'status' ? (sortDir === 'asc' ? '^' : 'v') : ''}</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingLeads ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 20 }}>Loading leads...</td></tr>
              ) : total === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 20 }}>No leads found.</td></tr>
              ) : (
                paged.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.id}</td>
                    <td>{lead.businessName}</td>
                    <td>{lead.businessEntity}</td>
                    <td>{lead.contactPerson}</td>
                    <td>{lead.primaryPhone}</td>
                    <td>{lead.city}</td>
                    <td>{lead.sourcedBy}</td>
                    <td>{lead.createdDate}</td>
                    <td>{lead.status}</td>
                    <td>
                      <button className="btn-secondary" onClick={() => handleEdit(lead)}>Edit</button>
                      <button className="btn-danger small" style={{ marginLeft: 8 }} onClick={() => handleDelete(lead)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div className="muted">Showing {total === 0 ? 0 : ((page - 1) * pageSize + 1)} to {Math.min(page * pageSize, total)} of {total} leads</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn-secondary" onClick={() => setPage(1)} disabled={page === 1}>|&lt;</button>
              <button className="btn-secondary" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>&lt;</button>
              <div style={{ padding: '6px 8px' }}>{page} / {totalPages}</div>
              <button className="btn-secondary" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>&gt;</button>
              <button className="btn-secondary" onClick={() => setPage(totalPages)} disabled={page === totalPages}>&gt;|</button>
              <select className="filter-select" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Leads;

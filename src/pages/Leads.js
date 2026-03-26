import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { addActivity } from '../utils/activities';
import { addToRecycleBin, getNextEntityId } from '../utils/recycleBin';
import './Customers.css';

function Leads() {
  const { user } = useAuth();
  const LEADS_KEY = 'leads';

  const [leads, setLeads] = useState(() => {
    try { const raw = localStorage.getItem(LEADS_KEY); return raw ? JSON.parse(raw) : []; } catch (e) { return []; }
  });

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ businessName: '', contactPerson: '', phone: '', city: '', sourcedBy: '', loanType: 'Business Loans', status: 'New' });
  const [search, setSearch] = useState('');
  const [typeTab, setTypeTab] = useState('Business Loans');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => { try { localStorage.setItem(LEADS_KEY, JSON.stringify(leads)); } catch (e) {} }, [leads]);

  const handleCreate = (e) => {
    e.preventDefault();
    const nextId = getNextEntityId('leads', leads);
    const item = { id: nextId, businessName: form.businessName, businessEntity: '', contactPerson: form.contactPerson, primaryPhone: form.phone, city: form.city, sourcedBy: form.sourcedBy, createdDate: new Date().toISOString().slice(0,10), status: form.status, loanType: form.loanType };
    setLeads(prev => [item, ...prev]);
    try { addActivity({ type: 'lead_created', actor: user?.username || 'system', message: `Lead #${nextId} created: ${form.businessName}`, meta: { leadId: nextId } }); } catch (e) {}
    setForm({ businessName: '', contactPerson: '', phone: '', city: '', sourcedBy: '', loanType: 'Business Loans', status: 'New' });
    setShowCreate(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this lead?')) return;
    const targetLead = leads.find((item) => item.id === id);
    if (!targetLead) return;
    addToRecycleBin({ entityType: 'leads', item: targetLead });
    setLeads(prev => prev.filter(l => l.id !== id));
    try { addActivity({ type: 'lead_deleted', actor: user?.username || 'system', message: `Lead #${id} moved to recycle bin`, meta: { leadId: id } }); } catch (e) {}
  };

  const tabs = ['Business Loans', 'Personal Loans', 'Home Loans', 'Mortgage Loans'];

  const counts = tabs.reduce((acc, t) => { acc[t] = leads.filter(l => (l.loanType || 'Business Loans') === t).length; return acc; }, {});

  const filtered = leads.filter(l => {
    if (typeTab && (l.loanType || 'Business Loans') !== typeTab) return false;
    if (statusFilter !== 'All' && (l.status || 'New') !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (l.businessName || '').toLowerCase().includes(s) || (l.contactPerson || '').toLowerCase().includes(s) || (l.primaryPhone || '').toLowerCase().includes(s);
  });

  // Sorting
  const sorted = React.useMemo(() => {
    if (!sortKey) return filtered;
    const copy = filtered.slice();
    copy.sort((a, b) => {
      const va = (a[sortKey] || '').toString().toLowerCase();
      const vb = (b[sortKey] || '').toString().toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [totalPages]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // CSV Bulk Upload
  const fileInputRef = React.useRef(null);
  const handleBulkClick = () => fileInputRef.current?.click();

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(line => {
      // simple CSV split (no complex quoting)
      const parts = line.split(',').map(p => p.trim());
      const obj = {};
      headers.forEach((h,i) => { obj[h] = parts[i] || ''; });
      return obj;
    });
    return rows;
  };

  const handleFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const rows = parseCSV(text);
      if (!rows.length) return;
      // map rows to lead objects
      const nextIdStart = getNextEntityId('leads', leads);
      const newLeads = rows.map((r, idx) => ({
        id: nextIdStart + idx,
        businessName: r['Business Name'] || r['businessName'] || r['Business'] || r['business'] || '',
        businessEntity: r['Business Entity'] || r['businessEntity'] || '',
        contactPerson: r['Contact Person'] || r['contactPerson'] || r['Contact'] || '',
        primaryPhone: r['Primary Phone'] || r['Phone'] || r['phone'] || '',
        city: r['City'] || r['city'] || '',
        sourcedBy: r['Sourced By'] || r['sourcedBy'] || '',
        createdDate: r['Created Date'] || new Date().toISOString().slice(0,10),
        status: r['Status'] || 'New',
        loanType: r['Loan Type'] || 'Business Loans'
      }));
      setLeads(prev => [...newLeads, ...prev]);
      try { addActivity({ type: 'leads_bulk_upload', actor: user?.username || 'system', message: `Bulk uploaded ${newLeads.length} leads`, meta: { count: newLeads.length } }); } catch (e) {}
      e.target.value = '';
    };
    reader.readAsText(f);
  };

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1>Leads</h1>
      </div>

      <div className="customer-card full-width" style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTypeTab(t)} className={`btn-secondary ${typeTab === t ? 'active' : ''}`} style={typeTab === t ? { background: '#5b4fcf', color: 'white' } : {}}>
                {t} ({counts[t] || 0})
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
          <input placeholder="Search by Business Name or Mobile" value={search} onChange={e => setSearch(e.target.value)} className="search-input" style={{ flex: 1 }} />
          <select className="filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="All">All</option>
            <option value="New">New Leads</option>
            <option value="Contacted">Contacted</option>
          </select>
        </div>

        {showCreate && (
          <div style={{ marginTop: 12 }}>
            <form onSubmit={handleCreate}>
              <div className="form-row">
                <div className="form-group">
                  <label>Business Name</label>
                  <input value={form.businessName} onChange={e => setForm({...form, businessName: e.target.value})} required />
                </div>
                <div className="form-group">
                  <label>Contact Person</label>
                  <input value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Primary Phone</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input value={form.city} onChange={e => setForm({...form, city: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Sourced By</label>
                  <input value={form.sourcedBy} onChange={e => setForm({...form, sourcedBy: e.target.value})} />
                </div>
                <div className="form-group">
                  <label>Loan Type</label>
                  <select value={form.loanType} onChange={e => setForm({...form, loanType: e.target.value})}>
                    {tabs.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ marginTop: 8 }} className="modal-actions">
                <button type="submit" className="btn-primary">Save Lead</button>
                <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)} style={{ marginLeft: 8 }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('id')} style={{ cursor: 'pointer' }}>Lead Id {sortKey === 'id' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('businessName')} style={{ cursor: 'pointer' }}>Business Name {sortKey === 'businessName' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('businessEntity')} style={{ cursor: 'pointer' }}>Business Entity {sortKey === 'businessEntity' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('contactPerson')} style={{ cursor: 'pointer' }}>Contact Person {sortKey === 'contactPerson' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('primaryPhone')} style={{ cursor: 'pointer' }}>Primary Phone {sortKey === 'primaryPhone' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('city')} style={{ cursor: 'pointer' }}>City {sortKey === 'city' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('sourcedBy')} style={{ cursor: 'pointer' }}>Sourced By {sortKey === 'sourcedBy' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('createdDate')} style={{ cursor: 'pointer' }}>Created Date {sortKey === 'createdDate' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
                <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer' }}>Status {sortKey === 'status' ? (sortDir==='asc' ? '▲' : '▼') : ''}</th>
                <th>Quick Actions</th>
              </tr>
            </thead>
            <tbody>
              {total === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 20 }}>No Leads Found</td></tr>
              ) : (
                paged.map(l => (
                  <tr key={l.id}>
                    <td>#{String(l.id).padStart(3,'0')}</td>
                    <td>{l.businessName}</td>
                    <td>{l.businessEntity}</td>
                    <td>{l.contactPerson}</td>
                    <td>{l.primaryPhone}</td>
                    <td>{l.city}</td>
                    <td>{l.sourcedBy}</td>
                    <td>{l.createdDate}</td>
                    <td>{l.status}</td>
                    <td>
                      <button className="btn-secondary">View</button>
                      <button className="btn-secondary" style={{ marginLeft: 8 }} onClick={() => { setForm({ businessName: l.businessName, contactPerson: l.contactPerson, phone: l.primaryPhone, city: l.city, sourcedBy: l.sourcedBy, loanType: l.loanType, status: l.status }); setShowCreate(true); }}>Edit</button>
                      <button className="btn-danger small" style={{ marginLeft: 8 }} onClick={() => handleDelete(l.id)}>Delete</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <div className="muted">Showing {(total===0)?0:((page-1)*pageSize+1)} To {Math.min(page*pageSize, total)} Of {total} Leads</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="btn-secondary" onClick={() => setPage(1)} disabled={page===1}>|&lt;</button>
              <button className="btn-secondary" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>&lt;</button>
              <div style={{ padding: '6px 8px' }}>{page} / {totalPages}</div>
              <button className="btn-secondary" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>&gt;</button>
              <button className="btn-secondary" onClick={() => setPage(totalPages)} disabled={page===totalPages}>&gt;|</button>
              <select className="filter-select" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
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

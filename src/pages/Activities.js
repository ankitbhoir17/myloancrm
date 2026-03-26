import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getActivities, markActivityRead, markAllRead, removeActivity, clearActivities } from '../utils/activities';
import './Customers.css';

function Activities() {
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [filterType, setFilterType] = useState('all');
  const [filterActor, setFilterActor] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    setActivities(getActivities());
    const onChange = () => setActivities(getActivities());
    window.addEventListener('activities:changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('activities:changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  if (!user || user.role !== 'superuser') {
    return (
      <div className="customers-page">
        <div className="page-header">
          <h1>Activities</h1>
        </div>
        <p>Access denied. Superuser only.</p>
      </div>
    );
  }

  const types = Array.from(new Set(activities.map(a => a.type))).filter(Boolean);

  const filtered = activities.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'read' && a.read !== true) return false;
      if (filterStatus === 'unread' && a.read === true) return false;
    }
    if (filterActor && !(a.actor || '').toLowerCase().includes(filterActor.toLowerCase())) return false;
    return true;
  });

  const handleMarkRead = (id) => {
    markActivityRead(id);
    setActivities(getActivities());
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this activity?')) return;
    removeActivity(id);
    setActivities(getActivities());
  };

  const handleClear = () => {
    if (!window.confirm('Clear all activities?')) return;
    clearActivities();
    setActivities([]);
  };

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1>Activity Management</h1>
      </div>

      <div className="filters">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
          <option value="all">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
          <option value="all">All Status</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>

        <input placeholder="Filter by actor" value={filterActor} onChange={(e) => setFilterActor(e.target.value)} className="search-input" />

        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-secondary" onClick={() => { markAllRead(); setActivities(getActivities()); }}>Mark all read</button>
          <button className="btn-danger" onClick={handleClear} style={{ marginLeft: 8 }}>Clear all</button>
        </div>
      </div>

      <div className="enquiries-list">
        {filtered.length === 0 ? (
          <p className="muted">No activities match your filters.</p>
        ) : (
          filtered.map(a => (
            <div key={a.id} className={`enquiry-card ${a.read ? 'read' : 'unread'}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{a.actor}</strong>
                  <div className="muted">{a.type} • {new Date(a.date).toLocaleString()}</div>
                </div>
                <div>
                  {!a.read && <button className="link-button" onClick={() => handleMarkRead(a.id)}>Mark read</button>}
                  <button className="link-button" onClick={() => handleDelete(a.id)} style={{ marginLeft: 8 }}>Delete</button>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>{a.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Activities;

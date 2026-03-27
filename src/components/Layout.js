import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getActivities, markActivityRead, markAllRead } from '../utils/activities';
import { getLoanStatusTone, LOAN_STATUS_MENU_ITEMS } from '../utils/loanWorkflow';
import { syncCrmCaches } from '../utils/crmData';
import './Layout.css';

const STATUS_TONE_CLASS_MAP = {
  approved: 'tone-emerald',
  rejected: 'tone-rose',
  disbursed: 'tone-sky',
  paid: 'tone-indigo',
  active: 'tone-amber',
  pending: 'tone-slate',
};

function NavGlyph({ name }) {
  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="8" height="8" rx="2" />
          <rect x="13" y="3" width="8" height="5" rx="2" />
          <rect x="13" y="10" width="8" height="11" rx="2" />
          <rect x="3" y="13" width="8" height="8" rx="2" />
        </svg>
      );
    case 'loan':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="12" rx="3" />
          <path d="M7 12h10" />
          <path d="M12 9v6" />
        </svg>
      );
    case 'customers':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
          <circle cx="9.5" cy="8" r="3.5" />
          <path d="M17 11a3 3 0 1 0 0-6" />
          <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
        </svg>
      );
    case 'recycle':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 7h10" />
          <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
          <path d="M18 7l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 7" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </svg>
      );
    case 'enquiries':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case 'activities':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12h4l2-5 4 10 2-5h4" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <circle cx="17.5" cy="9.5" r="2.5" />
          <path d="M15 20a4 4 0 0 1 6 0" />
        </svg>
      );
    case 'lenders':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10 12 4l9 6" />
          <path d="M5 10v8" />
          <path d="M9 10v8" />
          <path d="M15 10v8" />
          <path d="M19 10v8" />
          <path d="M3 20h18" />
        </svg>
      );
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-7" />
        </svg>
      );
    case 'accounting':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="3" />
          <path d="M8 8h8" />
          <path d="M8 12h3" />
          <path d="M8 16h8" />
          <path d="M15 11v2" />
          <path d="M14 12h2" />
        </svg>
      );
    case 'integrations':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="18" cy="7" r="2.5" />
          <circle cx="18" cy="17" r="2.5" />
          <path d="M8.4 11l7-3" />
          <path d="m8.4 13 7 3" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" />
        </svg>
      );
    case 'knowledge':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 9.8 8.3 4 10.5l5.8 2.2L12 18l2.2-5.3 5.8-2.2-5.8-2.2Z" />
        </svg>
      );
    case 'hrm':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="7" width="16" height="13" rx="2" />
          <path d="M9 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      );
    case 'roi':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 5 5 19" />
          <circle cx="7.5" cy="7.5" r="2.5" />
          <circle cx="16.5" cy="16.5" r="2.5" />
        </svg>
      );
    case 'bell':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 17H5.5a1 1 0 0 1-.8-1.6l1.1-1.5A4 4 0 0 0 6.6 11V9.8a5.4 5.4 0 1 1 10.8 0V11a4 4 0 0 0 .8 2.4l1.1 1.5a1 1 0 0 1-.8 1.6H15Z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'backup':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v10" />
          <path d="m8 9 4 4 4-4" />
          <path d="M5 17v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
          <rect x="4" y="15" width="16" height="6" rx="2" />
        </svg>
      );
    default:
      return null;
  }
}

function NavIcon({ iconKey, icon, toneClass = 'tone-slate', isStatus = false }) {
  return (
    <span className={`nav-icon ${toneClass} ${isStatus ? 'status-icon' : ''}`} aria-hidden="true">
      {iconKey ? <NavGlyph name={iconKey} /> : <span className="nav-icon-symbol">{icon}</span>}
    </span>
  );
}

function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activities, setActivities] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    let active = true;

    const warmCrmCache = async () => {
      try {
        await syncCrmCaches();
      } catch (error) {
        if (!active) {
          return;
        }
      }
    };

    warmCrmCache();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'superuser') {
      setActivities(getActivities());
    }

    const onChange = () => {
      if (user && user.role === 'superuser') {
        setActivities(getActivities());
      }
    };

    window.addEventListener('activities:changed', onChange);
    window.addEventListener('storage', onChange);

    return () => {
      window.removeEventListener('activities:changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [user]);

  useEffect(() => {
    const onDocClick = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotif(false);
      }
    };

    if (showNotif) {
      document.addEventListener('click', onDocClick);
    }

    return () => document.removeEventListener('click', onDocClick);
  }, [showNotif]);

  const unreadCount = activities.filter((item) => !item.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', label: 'Dashboard', iconKey: 'dashboard', toneClass: 'tone-sky', end: true },
    { to: '/loans', label: 'Loans', iconKey: 'loan', toneClass: 'tone-amber' },
    { to: '/customers', label: 'Customers', iconKey: 'customers', toneClass: 'tone-emerald' },
    { to: '/enquiries', label: 'Enquiries', iconKey: 'enquiries', toneClass: 'tone-violet' },
    { to: '/leads', label: 'Leads', iconKey: 'reports', toneClass: 'tone-cyan' },
  ];

  const superuserItems = [
    { to: '/recycle-bin', label: 'Recycle Bin', iconKey: 'recycle', toneClass: 'tone-rose' },
    { to: '/activities', label: 'Activities', iconKey: 'activities', toneClass: 'tone-teal' },
    { to: '/users', label: 'Users', iconKey: 'users', toneClass: 'tone-indigo' },
    { to: '/lenders', label: 'Lenders', iconKey: 'lenders', toneClass: 'tone-gold' },
  ];

  const footerItems = [
    { to: '/roi', label: 'ROI Calculators', iconKey: 'roi', toneClass: 'tone-orange' },
    ...(user && user.role === 'superuser'
      ? [{ to: '/backup', label: 'Backup Center', iconKey: 'backup', toneClass: 'tone-cyan' }]
      : []),
  ];

  return (
    <div className={`layout ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>MyLoanCRM</h2>
          <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '<' : '>'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <NavIcon iconKey={item.iconKey} toneClass={item.toneClass} />
              <span className="nav-text">{item.label}</span>
            </NavLink>
          ))}

          {LOAN_STATUS_MENU_ITEMS.map((item) => (
            <NavLink
              key={item.slug}
              to={`/loans/status/${item.slug}`}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <NavIcon
                icon={item.icon}
                toneClass={STATUS_TONE_CLASS_MAP[getLoanStatusTone(item.status)] || 'tone-slate'}
                isStatus
              />
              <span className="nav-text">{item.status}</span>
            </NavLink>
          ))}

          {user && user.role === 'superuser' ? (
            <>
              {superuserItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                >
                  <NavIcon iconKey={item.iconKey} toneClass={item.toneClass} />
                  <span className="nav-text">{item.label}</span>
                </NavLink>
              ))}
            </>
          ) : null}

          {footerItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <NavIcon iconKey={item.iconKey} toneClass={item.toneClass} />
              <span className="nav-text">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <h1 className="page-title">Welcome back!</h1>
          </div>

          <div className="header-right">
            {user ? (
              <>
                <div className="user-info">
                  <span className="user-name">{user.name}</span>
                  <span className="user-role">{user.role}</span>
                </div>

                {user.role === 'superuser' ? (
                  <div className="notif" ref={notifRef} style={{ position: 'relative', marginRight: 12 }}>
                    <button className="notif-btn" onClick={() => setShowNotif(!showNotif)} aria-label="Notifications">
                      <NavGlyph name="bell" />
                      {unreadCount > 0 ? <span className="notif-count">{unreadCount}</span> : null}
                    </button>

                    {showNotif ? (
                      <div className="notif-dropdown">
                        <div className="notif-header">
                          <strong>Recent Activities</strong>
                          <button className="link-button" onClick={() => { markAllRead(); setActivities(getActivities()); }}>
                            Mark all read
                          </button>
                        </div>
                        <div className="notif-list">
                          {activities.length === 0 ? (
                            <div className="muted">No activities</div>
                          ) : (
                            activities.slice(0, 20).map((item) => (
                              <div key={item.id} className={`notif-item ${item.read ? 'read' : 'unread'}`}>
                                <div className="notif-meta">
                                  <strong>{item.actor}</strong>
                                  <span className="muted"> - {new Date(item.date).toLocaleString()}</span>
                                </div>
                                <div className="notif-msg">{item.message}</div>
                                <div className="notif-actions">
                                  {!item.read ? (
                                    <button className="link-button" onClick={() => { markActivityRead(item.id); setActivities(getActivities()); }}>
                                      Mark read
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <button className="logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : null}
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;

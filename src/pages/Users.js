import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { addActivity } from '../utils/activities';
import { addToRecycleBin } from '../utils/recycleBin';
import { apiFetch, cacheLocalSnapshot, updateStoredAuthUser } from '../utils/api';
import './Customers.css';

const USERS_KEY = 'app_users';
const emptyForm = {
  id: null,
  username: '',
  name: '',
  email: '',
  role: 'user',
  password: '',
};

function normalizeUser(user) {
  return {
    id: user._id || user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    email: user.email,
    isActive: user.isActive,
    passwordSet: true,
  };
}

function recordActivitySafely(payload) {
  try {
    addActivity(payload);
  } catch (error) {
    // Ignore activity failures to keep user management responsive.
  }
}

function Users() {
  const { user, refreshUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [pageError, setPageError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [formValues, setFormValues] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const syncUsersSnapshot = (nextUsers) => {
    setUsers(nextUsers);
    cacheLocalSnapshot(USERS_KEY, nextUsers);

    const currentSessionUser = nextUsers.find((item) => item.id === user?.id);
    if (currentSessionUser) {
      updateStoredAuthUser(currentSessionUser);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadUsers = async () => {
      if (!user || user.role !== 'superuser') {
        if (isMounted) {
          setLoadingUsers(false);
        }
        return;
      }

      try {
        setLoadingUsers(true);
        setPageError('');
        const payload = await apiFetch('/api/users');
        const nextUsers = (payload?.data || []).map(normalizeUser);
        if (isMounted) {
          syncUsersSnapshot(nextUsers);
        }
      } catch (error) {
        if (isMounted) {
          setPageError(error.message || 'Failed to load users.');
          setUsers([]);
        }
      } finally {
        if (isMounted) {
          setLoadingUsers(false);
        }
      }
    };

    loadUsers();

    return () => {
      isMounted = false;
    };
  }, [user]);

  const superuserCount = useMemo(
    () => users.filter((item) => item.role === 'superuser').length,
    [users]
  );

  const filteredUsers = users.filter((item) => {
    const matchesRole = roleFilter === 'all' || item.role === roleFilter;
    const query = search.trim().toLowerCase();
    const haystack = `${item.username} ${item.name} ${item.email}`.toLowerCase();
    const matchesSearch = !query || haystack.includes(query);
    return matchesRole && matchesSearch;
  });

  const closeModal = () => {
    setShowModal(false);
    setEditingUserId(null);
    setFormValues(emptyForm);
    setFormError('');
    setSaving(false);
  };

  const openAddModal = () => {
    setEditingUserId(null);
    setFormValues(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (selectedUser) => {
    setEditingUserId(selectedUser.id);
    setFormValues({
      id: selectedUser.id,
      username: selectedUser.username,
      name: selectedUser.name,
      email: selectedUser.email,
      role: selectedUser.role,
      password: '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setFormError('');
    setSaving(true);

    const username = formValues.username.trim();
    const name = formValues.name.trim();
    const email = (formValues.email || `${username}@myloancrm.com`).trim().toLowerCase();
    const password = formValues.password.trim();

    if (!username || !name) {
      setFormError('Username and full name are required.');
      setSaving(false);
      return;
    }

    if (!editingUserId && !password) {
      setFormError('Password is required for new users.');
      setSaving(false);
      return;
    }

    try {
      let nextUsers = users;

      if (editingUserId) {
        const payload = await apiFetch(`/api/users/${editingUserId}`, {
          method: 'PUT',
          body: {
            username,
            name,
            email,
            role: formValues.role,
            ...(password ? { password } : {}),
          },
        });

        const updatedUser = normalizeUser(payload?.data);
        nextUsers = users.map((item) => (
          item.id === editingUserId ? updatedUser : item
        ));

        recordActivitySafely({
          type: 'user_updated',
          actor: user?.username || 'system',
          message: `User ${username} updated by ${user?.username || 'system'}`,
          meta: { userId: editingUserId },
        });
      } else {
        const payload = await apiFetch('/api/users', {
          method: 'POST',
          body: {
            username,
            name,
            email,
            role: formValues.role,
            password,
          },
        });

        const createdUser = normalizeUser(payload?.data);
        nextUsers = [...users, createdUser];

        recordActivitySafely({
          type: 'user_created',
          actor: user?.username || 'system',
          message: `User ${username} created by ${user?.username || 'system'}`,
          meta: { userId: createdUser.id },
        });
      }

      syncUsersSnapshot(nextUsers);
      closeModal();
      if (editingUserId === user?.id) {
        try {
          await refreshUser();
        } catch (error) {
          // Keep the local snapshot even if session refresh fails.
        }
      }
    } catch (error) {
      setFormError(error.message || 'Failed to save user.');
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const targetUser = users.find((item) => item.id === id);
    if (!targetUser) {
      return;
    }

    if (user?.id === id) {
      alert('You cannot delete the currently signed-in user.');
      return;
    }

    if (targetUser.role === 'superuser' && superuserCount === 1) {
      alert('At least one superuser must remain.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${targetUser.username}?`)) {
      return;
    }

    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      const nextUsers = users.filter((item) => item.id !== id);
      addToRecycleBin({ entityType: 'users', item: targetUser });
      syncUsersSnapshot(nextUsers);

      recordActivitySafely({
        type: 'user_deleted',
        actor: user?.username || 'system',
        message: `User ${targetUser.username} moved to recycle bin by ${user?.username || 'system'}`,
        meta: { userId: id },
      });
    } catch (error) {
      alert(error.message || 'Failed to delete user.');
    }
  };

  const handleResetPassword = async (id) => {
    const targetUser = users.find((item) => item.id === id);
    if (!targetUser) {
      return;
    }

    const passwordValue = prompt(`Enter a new password for ${targetUser.username}:`, 'password123');
    if (passwordValue === null) {
      return;
    }

    const newPassword = passwordValue.trim() || 'password123';

    try {
      await apiFetch(`/api/users/${id}/password`, {
        method: 'PATCH',
        body: { password: newPassword },
      });

      syncUsersSnapshot(users.map((item) => (
        item.id === id ? { ...item, passwordSet: true } : item
      )));
      alert(`Password updated for ${targetUser.username}.`);

      recordActivitySafely({
        type: 'user_password_reset',
        actor: user?.username || 'system',
        message: `Password reset for ${targetUser.username} by ${user?.username || 'system'}`,
        meta: { userId: id },
      });
    } catch (error) {
      alert(error.message || 'Failed to reset password.');
    }
  };

  if (!user || user.role !== 'superuser') {
    return (
      <div className="customers-page">
        <div className="page-header">
          <h1>Users</h1>
        </div>
        <p>Access denied. Superuser only.</p>
      </div>
    );
  }

  return (
    <div className="customers-page">
      <div className="page-header">
        <h1>Users Management</h1>
        <button className="btn-primary" onClick={openAddModal}>+ Add User</button>
      </div>

      {pageError ? <div className="error-message">{pageError}</div> : null}

      <div className="filters">
        <input
          className="search-input"
          placeholder="Search by username, name, or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All Roles</option>
          <option value="superuser">Superuser</option>
          <option value="user">User</option>
          <option value="auditor">Auditor</option>
        </select>
      </div>

      <div className="customers-grid">
        <div className="customer-card full-width">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Registered Users</h3>
            <span className="muted">
              {loadingUsers ? 'Loading users...' : `${filteredUsers.length} of ${users.length} users`}
            </span>
          </div>

          {loadingUsers ? (
            <p className="muted">Loading users from the server...</p>
          ) : filteredUsers.length === 0 ? (
            <p className="muted">No users match the current filters.</p>
          ) : (
            <div className="loans-table-container">
              <table className="loans-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.username}</td>
                      <td>{item.name}</td>
                      <td>{item.role}</td>
                      <td>{item.email}</td>
                      <td>
                        <button className="btn-secondary" onClick={() => openEditModal(item)}>Edit</button>
                        <button className="btn-secondary" onClick={() => handleResetPassword(item.id)} style={{ marginLeft: 8 }}>
                          Reset Password
                        </button>
                        <button className="btn-danger" onClick={() => handleDelete(item.id)} style={{ marginLeft: 8 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal ? (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingUserId ? 'Edit User' : 'Add New User'}</h2>
              <button type="button" className="modal-close" onClick={closeModal}>x</button>
            </div>

            <form onSubmit={handleSaveUser}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  value={formValues.name}
                  onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Username</label>
                <input
                  value={formValues.username}
                  onChange={(e) => setFormValues({ ...formValues, username: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={formValues.email}
                  onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                  placeholder="user@myloancrm.com"
                />
              </div>

              <div className="form-group">
                <label>Role</label>
                <select
                  className="filter-select"
                  value={formValues.role}
                  onChange={(e) => setFormValues({ ...formValues, role: e.target.value })}
                >
                  <option value="superuser">Superuser</option>
                  <option value="user">User</option>
                  <option value="auditor">Auditor</option>
                </select>
              </div>

              <div className="form-group">
                <label>{editingUserId ? 'Password (leave blank to keep current password)' : 'Password'}</label>
                <input
                  type="password"
                  value={formValues.password}
                  onChange={(e) => setFormValues({ ...formValues, password: e.target.value })}
                  required={!editingUserId}
                />
              </div>

              {formError ? <div className="error-message">{formError}</div> : null}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : (editingUserId ? 'Save Changes' : 'Create User')}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Users;

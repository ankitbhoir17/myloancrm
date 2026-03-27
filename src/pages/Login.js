import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField';
import { useAuth } from '../context/AuthContext';
import './Login.css';

function Login() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupStatusError, setSetupStatusError] = useState('');
  const navigate = useNavigate();
  const { login, register, checkSetupStatus } = useAuth();

  useEffect(() => {
    let isMounted = true;

    const loadSetupStatus = async () => {
      try {
        const requiresSetup = await checkSetupStatus();
        if (isMounted) {
          setSetupRequired(requiresSetup);
          setSetupStatusError('');
        }
      } catch (err) {
        if (isMounted) {
          setSetupRequired(false);
          setSetupStatusError('Unable to verify setup status right now. If this is a fresh install, check that the backend and database are running.');
        }
      }
    };

    loadSetupStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (setupRequired) {
        await register(username, password, name, email, 'superuser');
      } else {
        await login(username, password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || 'Unable to complete authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="login-brand">AB Infotech softwares</div>
          <h1>AedlxLoanCRM</h1>
          <p>{setupRequired ? 'Create your first superuser account' : 'Loan Management System'}</p>
        </div>
        <form onSubmit={handleSubmit}>
          {setupRequired ? (
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter full name"
                required
              />
            </div>
          ) : null}
          <div className="form-group">
            <label htmlFor="username">Username / Email</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username or email"
              required
            />
          </div>
          {setupRequired ? (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                required
              />
            </div>
          ) : null}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <PasswordField
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete={setupRequired ? 'new-password' : 'current-password'}
            />
          </div>
          {setupStatusError ? <div className="error-message">{setupStatusError}</div> : null}
          {error ? <div className="error-message">{error}</div> : null}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (setupRequired ? 'Creating Superuser...' : 'Signing in...') : (setupRequired ? 'Create Superuser' : 'Sign In')}
          </button>
        </form>
        <div className="login-footer">
          <div style={{ color: '#666', fontSize: 14 }}>
            {setupRequired
              ? 'This is the first launch. The first account created here becomes the superuser.'
              : 'New users are created by a superuser from User Management.'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;

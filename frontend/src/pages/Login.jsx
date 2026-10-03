import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import { MusicNoteIcon } from '../components/Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { validateLogin } from '../utils/validation.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { notice, identifier: prefill = '', from } = location.state || {};

  const [form, setForm] = useState({ identifier: prefill, password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const validation = validateLogin(form);
    if (validation.error) {
      setError(validation.error);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(form);
      navigate(from || '/profile', { replace: true });
    } catch (err) {
      setError(err.message);
      setForm((prev) => ({ ...prev, password: '' }));
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="auth-mark" aria-hidden="true"><MusicNoteIcon size={22} strokeWidth={2.2} /></span>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Log in to your TuneBoxd account.</p>
        <form onSubmit={handleSubmit} noValidate>
          {!error && <Alert type="success">{notice}</Alert>}
          <Alert type="error">{error}</Alert>
          <FormField
            id="identifier"
            label="Username or email"
            autoComplete="username"
            value={form.identifier}
            onChange={handleChange}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            autoFocus={Boolean(prefill)}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log In'}
          </button>
        </form>
        <p className="auth-switch">
          New to TuneBoxd? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </section>
  );
}

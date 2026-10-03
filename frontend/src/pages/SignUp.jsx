import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api/auth.js';
import Alert from '../components/Alert.jsx';
import FormField from '../components/FormField.jsx';
import { MusicNoteIcon } from '../components/Icons.jsx';
import { validateSignUp } from '../utils/validation.js';

const EMPTY_FORM = { username: '', email: '', password: '', confirmPassword: '' };

export default function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: null }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const validation = validateSignUp(form);
    if (validation.error) {
      setError(validation.error);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await registerUser(form);
      navigate('/login', {
        state: { notice: 'Account created! Log in to continue.', identifier: form.username.trim() },
      });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <span className="auth-mark" aria-hidden="true"><MusicNoteIcon size={22} strokeWidth={2.2} /></span>
        <h1 className="auth-title">Join TuneBoxd</h1>
        <p className="auth-subtitle">Create an account to start tracking your music.</p>
        <form onSubmit={handleSubmit} noValidate>
          <Alert type="error">{error}</Alert>
          <FormField
            id="username"
            label="Username"
            autoComplete="username"
            value={form.username}
            onChange={handleChange}
            error={fieldErrors.username}
          />
          <FormField
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            error={fieldErrors.email}
          />
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            error={fieldErrors.password}
          />
          <FormField
            id="confirmPassword"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={fieldErrors.confirmPassword}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>
        </form>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </section>
  );
}

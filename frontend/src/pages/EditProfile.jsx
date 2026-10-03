import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert.jsx';
import Avatar from '../components/Avatar.jsx';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { resizeImageToDataUrl } from '../utils/image.js';
import { BIO_MAX_LENGTH, validateProfile } from '../utils/validation.js';

export default function EditProfile() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [form, setForm] = useState({
    displayName: user?.displayName ?? '',
    username: user?.username ?? '',
    email: user?.email ?? '',
    bio: user?.bio ?? '',
  });
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: null }));
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    setFieldErrors((prev) => ({ ...prev, avatarUrl: null }));
    try {
      setAvatarUrl(await resizeImageToDataUrl(file));
      setAvatarChanged(true);
    } catch (err) {
      setFieldErrors((prev) => ({ ...prev, avatarUrl: err.message }));
    }
  }

  function handleRemovePhoto() {
    setAvatarUrl(null);
    setAvatarChanged(true);
    setFieldErrors((prev) => ({ ...prev, avatarUrl: null }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const validation = validateProfile(form);
    if (validation.error) {
      setError(validation.error);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    setIsSaving(true);
    try {
      // Only send the image when it changed, to keep requests small.
      await updateProfile(avatarChanged ? { ...form, avatarUrl } : form);
      navigate('/profile', { state: { notice: 'Profile updated.' } });
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setIsSaving(false);
    }
  }

  return (
    <section className="narrow">
      <h1 className="page-title">Edit Profile</h1>
      <p className="page-subtitle">Update your photo, name, bio and account details.</p>
      <form className="card" onSubmit={handleSubmit} noValidate>
        <Alert type="error">{error}</Alert>

        <div className="avatar-editor">
          <Avatar username={form.username || user?.username} src={avatarUrl} size="lg" />
          <div>
            <p className="avatar-editor-title">Profile picture</p>
            <div className="avatar-editor-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => fileInput.current?.click()}>
                {avatarUrl ? 'Change photo' : 'Upload photo'}
              </button>
              {avatarUrl && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemovePhoto}>
                  Remove
                </button>
              )}
            </div>
            <p className="field-hint">PNG, JPEG or WebP. It will be cropped to a square.</p>
            {fieldErrors.avatarUrl && <p className="field-error">{fieldErrors.avatarUrl}</p>}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              hidden
            />
          </div>
        </div>

        <FormField
          id="displayName"
          label="Display name (optional)"
          autoComplete="name"
          placeholder="e.g. Alex Rivera"
          value={form.displayName}
          onChange={handleChange}
          error={fieldErrors.displayName}
        />
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

        <div className={`field${fieldErrors.bio ? ' field-invalid' : ''}`}>
          <label htmlFor="bio">Bio (optional)</label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            placeholder="Tell people what you’re listening to."
            value={form.bio}
            onChange={handleChange}
            aria-invalid={Boolean(fieldErrors.bio)}
            aria-describedby="bio-count"
          />
          <p id="bio-count" className={`field-hint align-right${form.bio.length > BIO_MAX_LENGTH ? ' is-over' : ''}`}>
            {form.bio.length}/{BIO_MAX_LENGTH}
          </p>
          {fieldErrors.bio && <p className="field-error">{fieldErrors.bio}</p>}
        </div>

        <div className="form-actions">
          <Link to="/profile" className="btn btn-outline">
            Cancel
          </Link>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
}

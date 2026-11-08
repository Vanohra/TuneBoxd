import { useState } from 'react';
import { createList, updateList } from '../api/lists.js';
import { LIST_DESCRIPTION_MAX_LENGTH, validateList } from '../utils/validation.js';
import Alert from './Alert.jsx';
import FormField from './FormField.jsx';
import { GlobeIcon, LockIcon } from './Icons.jsx';

/**
 * Create a list, or edit one (pass `list`). Includes the public/private choice
 * (client requirement CR-01). `onSaved(list)` runs after the backend confirms.
 */
export default function ListForm({ list, onSaved, onCancel, idPrefix = 'list', submitLabel }) {
  const isEdit = Boolean(list);
  const [title, setTitle] = useState(list?.title ?? '');
  const [description, setDescription] = useState(list?.description ?? '');
  const [isPublic, setIsPublic] = useState(list?.isPublic ?? true);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const validation = validateList({ title, description });
    if (validation.error) {
      setFieldErrors(validation.fieldErrors);
      setError(validation.error);
      return;
    }
    setIsSaving(true);
    try {
      const values = { title, description, isPublic };
      onSaved(isEdit ? await updateList(list.id, values) : await createList(values));
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setIsSaving(false);
    }
  }

  return (
    <form className="list-form" onSubmit={handleSubmit} noValidate>
      <Alert type="error">{error}</Alert>
      <FormField
        id={`${idPrefix}-title`}
        label="Title"
        value={title}
        placeholder="e.g. Late-night albums"
        onChange={(event) => {
          setTitle(event.target.value);
          setFieldErrors((prev) => ({ ...prev, title: null }));
        }}
        error={fieldErrors.title}
        autoFocus={!isEdit}
      />
      <div className={`field${fieldErrors.description ? ' field-invalid' : ''}`}>
        <label htmlFor={`${idPrefix}-description`}>Description (optional)</label>
        <textarea
          id={`${idPrefix}-description`}
          rows={3}
          placeholder="What ties these together?"
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setFieldErrors((prev) => ({ ...prev, description: null }));
          }}
        />
        <p className={`field-hint align-right${description.trim().length > LIST_DESCRIPTION_MAX_LENGTH ? ' is-over' : ''}`}>
          {description.trim().length}/{LIST_DESCRIPTION_MAX_LENGTH}
        </p>
        {fieldErrors.description && <p className="field-error">{fieldErrors.description}</p>}
      </div>
      <div className="field">
        <span className="field-label">Visibility</span>
        <div className="segmented" role="radiogroup" aria-label="List visibility">
          {[
            { value: true, label: 'Public', Icon: GlobeIcon },
            { value: false, label: 'Private', Icon: LockIcon },
          ].map(({ value, label, Icon }) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={isPublic === value}
              className={isPublic === value ? 'is-active' : ''}
              onClick={() => setIsPublic(value)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
        <p className="field-hint">{isPublic ? 'Anyone can see this list on your profile.' : 'Only you can see this list.'}</p>
      </div>
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : submitLabel ?? (isEdit ? 'Save Changes' : 'Create List')}
        </button>
      </div>
    </form>
  );
}


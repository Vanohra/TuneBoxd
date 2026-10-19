import { useState } from 'react';
import { createDiaryEntry, updateDiaryEntry } from '../api/diary.js';
import { todayYmd } from '../utils/format.js';
import { DIARY_NOTES_MAX_LENGTH, validateDiaryEntry } from '../utils/validation.js';
import Alert from './Alert.jsx';
import FormField from './FormField.jsx';

/**
 * Log a listen (pass targetType + mbid) or edit an entry (pass `entry`).
 * `onSaved(entry)` runs only after the backend confirms the save.
 */
export default function DiaryEntryForm({ targetType, mbid, entry, onSaved, onCancel, idPrefix = 'diary' }) {
  const isEdit = Boolean(entry);
  const today = todayYmd();
  const [listenedOn, setListenedOn] = useState(entry?.listenedOn ?? today);
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const validation = validateDiaryEntry({ listenedOn, notes }, today);
    if (validation.error) {
      setFieldErrors(validation.fieldErrors);
      setError(validation.error);
      return;
    }
    setIsSaving(true);
    try {
      const saved = isEdit
        ? await updateDiaryEntry(entry.id, { listenedOn, notes })
        : await createDiaryEntry({ targetType, mbid, listenedOn, notes });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
      setFieldErrors(err.fieldErrors || {});
      setIsSaving(false);
    }
  }

  return (
    <form className="diary-form" onSubmit={handleSubmit} noValidate>
      <Alert type="error">{error}</Alert>
      <FormField
        id={`${idPrefix}-date`}
        label="Date listened"
        type="date"
        max={today}
        min="1900-01-01"
        value={listenedOn}
        onChange={(event) => {
          setListenedOn(event.target.value);
          setFieldErrors((prev) => ({ ...prev, listenedOn: null }));
        }}
        error={fieldErrors.listenedOn}
      />
      <div className={`field${fieldErrors.notes ? ' field-invalid' : ''}`}>
        <label htmlFor={`${idPrefix}-notes`}>Notes (optional)</label>
        <textarea
          id={`${idPrefix}-notes`}
          rows={3}
          placeholder="Where were you? How did it feel?"
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
            setFieldErrors((prev) => ({ ...prev, notes: null }));
          }}
        />
        <p className={`field-hint align-right${notes.trim().length > DIARY_NOTES_MAX_LENGTH ? ' is-over' : ''}`}>
          {notes.trim().length}/{DIARY_NOTES_MAX_LENGTH}
        </p>
        {fieldErrors.notes && <p className="field-error">{fieldErrors.notes}</p>}
      </div>
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add to Diary'}
        </button>
      </div>
    </form>
  );
}

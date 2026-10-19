import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createComment, deleteComment, fetchComments, updateComment } from '../api/reviews.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDate } from '../utils/format.js';
import { COMMENT_MAX_LENGTH, validateCommentText } from '../utils/validation.js';
import Alert from './Alert.jsx';
import Avatar from './Avatar.jsx';
import { Loading } from './Status.jsx';

function CommentEditor({ initial = '', submitLabel, busyLabel, onSubmit, onCancel, autoFocus }) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = validateCommentText(text);
    if (problem) return setError(problem);
    setIsSaving(true);
    setError('');
    try {
      await onSubmit(text);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="comment-editor" onSubmit={handleSubmit} noValidate>
      <div className={`field${error ? ' field-invalid' : ''}`}>
        <textarea
          rows={2}
          aria-label="Comment"
          placeholder="Add a comment…"
          value={text}
          autoFocus={autoFocus}
          onChange={(event) => {
            setText(event.target.value);
            setError('');
          }}
        />
        <div className="comment-editor-footer">
          {error ? <p className="field-error">{error}</p> : <span />}
          <span className={`field-hint${text.trim().length > COMMENT_MAX_LENGTH ? ' is-over' : ''}`}>
            {text.trim().length}/{COMMENT_MAX_LENGTH}
          </span>
        </div>
      </div>
      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={isSaving}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>
          {isSaving ? busyLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}

function CommentItem({ comment, onUpdated, onDeleted }) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    try {
      await deleteComment(comment.id);
      onDeleted(comment.id);
    } catch (err) {
      setError(err.message);
      setConfirmDelete(false);
    }
  }

  const edited = comment.updatedAt && new Date(comment.updatedAt) - new Date(comment.createdAt) > 1000;

  return (
    <li className="comment">
      <Link to={`/u/${comment.author.username}`} className="comment-avatar" aria-hidden="true" tabIndex={-1}>
        <Avatar username={comment.author.username} src={comment.author.avatarUrl} size="sm" />
      </Link>
      <div className="comment-body">
        <p className="comment-meta">
          <Link to={`/u/${comment.author.username}`} className="comment-author">
            {comment.author.displayName || comment.author.username}
          </Link>
          <span className="muted">@{comment.author.username}</span>
          <span className="muted">· {formatDate(comment.createdAt)}{edited ? ' (edited)' : ''}</span>
        </p>
        {isEditing ? (
          <CommentEditor
            initial={comment.text}
            submitLabel="Save"
            busyLabel="Saving…"
            autoFocus
            onCancel={() => setIsEditing(false)}
            onSubmit={async (text) => {
              onUpdated(await updateComment(comment.id, text));
              setIsEditing(false);
            }}
          />
        ) : (
          <p className="user-text">{comment.text}</p>
        )}
        <Alert type="error">{error}</Alert>
        {comment.isOwner && !isEditing && (
          <div className="inline-actions">
            {confirmDelete ? (
              <>
                <span className="muted">Delete this comment?</span>
                <button type="button" className="link-button danger" onClick={handleDelete}>
                  Delete
                </button>
                <button type="button" className="link-button" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button type="button" className="link-button" onClick={() => setIsEditing(true)}>
                  Edit
                </button>
                <button type="button" className="link-button" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Comments under one review. Anyone can read; logged-in users can post. */
export default function CommentSection({ reviewId, onCountChange }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [comments, setComments] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchComments(reviewId)
      .then((list) => !cancelled && setComments(list))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  function update(next) {
    setComments(next);
    onCountChange?.(next.length);
  }

  return (
    <section className="comments" aria-label="Comments">
      {error ? (
        <p className="empty-text">{error}</p>
      ) : comments === null ? (
        <Loading inline label="Loading comments…" />
      ) : comments.length === 0 ? (
        <p className="empty-text">No comments yet.{isAuthenticated ? ' Start the conversation!' : ''}</p>
      ) : (
        <ul className="comment-list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onUpdated={(saved) => update(comments.map((c) => (c.id === saved.id ? saved : c)))}
              onDeleted={(id) => update(comments.filter((c) => c.id !== id))}
            />
          ))}
        </ul>
      )}

      {notice && <Alert type="success">{notice}</Alert>}

      {isAuthenticated ? (
        comments !== null && (
          <CommentEditor
            submitLabel="Post Comment"
            busyLabel="Posting…"
            onSubmit={async (text) => {
              const saved = await createComment(reviewId, text);
              update([...comments, saved]);
              setNotice('Comment posted.');
              setTimeout(() => setNotice(''), 3000);
            }}
          />
        )
      ) : (
        <p className="empty-text">
          <Link to="/login" state={{ from: location.pathname, notice: 'Log in to join the conversation.' }}>
            Log in
          </Link>{' '}
          to comment.
        </p>
      )}
    </section>
  );
}

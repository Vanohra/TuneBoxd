const COLORS = ['#7c5cff', '#f76707', '#1c9fd6', '#e64980', '#0ca678'];

/**
 * Profile picture. Shows the uploaded image when `src` is set; otherwise the
 * user's initial on a color picked from their username.
 */
export default function Avatar({ username = '', src = null, size = 'md' }) {
  if (src) {
    return <img className={`avatar avatar-${size}`} src={src} alt="" />;
  }
  const initial = username.charAt(0).toUpperCase() || '?';
  const hash = [...username].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <span className={`avatar avatar-${size}`} style={{ '--avatar-color': COLORS[hash % COLORS.length] }} aria-hidden="true">
      {initial}
    </span>
  );
}

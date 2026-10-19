import { useEffect, useState } from 'react';

const GRADIENTS = [
  ['#2b1a6b', '#6d4aff'],
  ['#1f3b5c', '#0b1626'],
  ['#3a3a3a', '#111'],
  ['#3d7bd9', '#1c2a4a'],
  ['#5c2b4a', '#1b1b2f'],
];

/**
 * Album artwork from Cover Art Archive. Many albums have no uploaded cover, so
 * when there's no URL or the image fails to load, it shows a vinyl-style
 * placeholder tinted from the album ID instead of a broken image.
 */
export default function CoverArt({ src, alt = '', seed = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img className={`album-cover cover-img ${className}`} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
    );
  }
  const hash = [...String(seed)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const [from, to] = GRADIENTS[hash % GRADIENTS.length];
  return (
    <div
      className={`album-cover cover-placeholder ${className}`}
      style={{ background: `linear-gradient(145deg, ${from}, ${to})` }}
      role="img"
      aria-label={alt ? `${alt} (no cover available)` : 'No cover available'}
    >
      <span className="album-disc" />
    </div>
  );
}

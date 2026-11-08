import { Link } from 'react-router-dom';
import CoverArt from './CoverArt.jsx';
import { LockIcon } from './Icons.jsx';

/** Grid of list cards: a 4-cover collage, title, owner and item count. */
export default function ListGrid({ lists, showOwner = false }) {
  return (
    <ul className="list-grid">
      {lists.map((list) => (
        <li key={list.id}>
          <Link to={`/lists/${list.id}`} className="list-card">
            <span className="list-collage" aria-hidden="true">
              {[0, 1, 2, 3].map((i) =>
                list.preview[i] ? (
                  <CoverArt key={i} src={list.preview[i].coverUrl} seed={list.preview[i].mbid} alt="" />
                ) : (
                  <span key={i} className="album-cover album-cover-empty" />
                ),
              )}
            </span>
            <span className="list-card-title">
              {!list.isPublic && <LockIcon size={14} aria-label="Private" />}
              {list.title}
            </span>
            <span className="muted small">
              {showOwner && `@${list.owner.username} · `}
              {list.itemCount} item{list.itemCount === 1 ? '' : 's'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

import { Link } from 'react-router-dom';
import { MusicNoteIcon } from './Icons.jsx';

/** TuneBoxd wordmark: purple music-note tile + name. */
export default function Logo() {
  return (
    <Link to="/" className="logo" aria-label="TuneBoxd home">
      <span className="logo-mark" aria-hidden="true">
        <MusicNoteIcon size={18} strokeWidth={2.2} />
      </span>
      <span className="logo-text">TuneBoxd</span>
    </Link>
  );
}

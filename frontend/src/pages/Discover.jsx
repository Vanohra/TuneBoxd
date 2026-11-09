import { useState } from 'react';
import { Link } from 'react-router-dom';
import { discoverMusic } from '../api/insights.js';
import Alert from '../components/Alert.jsx';
import CoverArt from '../components/CoverArt.jsx';
import { WandIcon } from '../components/Icons.jsx';
import { Loading } from '../components/Status.jsx';
import { releaseYear } from '../utils/format.js';

const PROMPT_MAX_LENGTH = 300;

const EXAMPLES = [
  'Moody indie albums for a rainy night, like Radiohead',
  'Upbeat 80s pop for a road trip',
  'Jazz albums for someone who only listens to hip-hop',
  'Something calm to study to, no lyrics',
];

/**
 * /discover (protected): "Ask TuneBoxd". Describe what you want to hear;
 * Google Gemini suggests albums and the server keeps only the ones it can find
 * on MusicBrainz, so every card links to a real album page.
 */
export default function Discover() {
  const [prompt, setPrompt] = useState('');
  const [state, setState] = useState({ status: 'idle' });

  async function ask(text) {
    const value = text.trim();
    if (value.length < 3 || state.status === 'loading') return;
    setPrompt(value);
    setState({ status: 'loading' });
    try {
      setState({ status: 'done', data: await discoverMusic(value) });
    } catch (error) {
      setState({ status: 'error', error });
    }
  }

  const { data } = state;

  return (
    <div className="narrow-wide stack">
      <div className="page-heading">
        <div>
          <h1 className="page-title">Ask TuneBoxd</h1>
          <p className="page-subtitle">Describe what you want to hear, and AI will find albums for it.</p>
        </div>
      </div>

      <section className="card">
        <form
          className="discover-form"
          onSubmit={(event) => {
            event.preventDefault();
            ask(prompt);
          }}
        >
          <label htmlFor="discover-prompt" className="field-label">
            What are you in the mood for?
          </label>
          <textarea
            id="discover-prompt"
            rows={2}
            value={prompt}
            maxLength={PROMPT_MAX_LENGTH}
            placeholder="e.g. Dreamy shoegaze albums from the 90s with loud guitars"
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                ask(prompt);
              }
            }}
          />
          <div className="discover-form-footer">
            <div className="discover-examples" aria-label="Example requests">
              {EXAMPLES.map((example) => (
                <button key={example} type="button" className="example-chip" onClick={() => ask(example)} disabled={state.status === 'loading'}>
                  {example}
                </button>
              ))}
            </div>
            <button type="submit" className="btn btn-primary" disabled={prompt.trim().length < 3 || state.status === 'loading'}>
              <WandIcon size={16} />
              {state.status === 'loading' ? 'Thinking…' : 'Find Music'}
            </button>
          </div>
        </form>
      </section>

      {state.status === 'loading' && (
        <section className="card">
          <Loading inline label="Asking the AI, then checking each album on MusicBrainz… (about 10 seconds)" />
        </section>
      )}

      {state.status === 'error' && <Alert type="error">{state.error.message}</Alert>}

      {state.status === 'done' && (
        <section className="card">
          {data.interpretation && (
            <p className="discover-interpretation">
              <WandIcon size={15} /> {data.interpretation}
            </p>
          )}
          {data.results.length === 0 ? (
            <p className="empty-text">
              The AI’s suggestions couldn’t be matched to real albums this time. Try rephrasing, or name an artist or genre.
            </p>
          ) : (
            <ul className="discover-results">
              {data.results.map((album) => (
                <li key={album.mbid}>
                  <Link to={`/album/${album.mbid}`} className="discover-result">
                    <CoverArt src={album.coverUrl} seed={album.mbid} alt="" className="discover-cover" />
                    <span className="discover-result-text">
                      <span className="result-row-title">{album.title}</span>
                      <span className="muted small">
                        {album.artistName}
                        {album.releaseDate ? ` · ${releaseYear(album.releaseDate)}` : ''}
                        {album.alreadyKnown && <span className="known-badge">In your history</span>}
                      </span>
                      <span className="recommendation-reason">{album.reason}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="field-hint">
            Suggestions by Google Gemini (AI). Each album was checked on MusicBrainz
            {data.suggestedCount > data.results.length
              ? `; ${data.suggestedCount - data.results.length} suggestion${data.suggestedCount - data.results.length === 1 ? '' : 's'} couldn’t be verified and ${data.suggestedCount - data.results.length === 1 ? 'was' : 'were'} left out`
              : ''}
            .
          </p>
        </section>
      )}
    </div>
  );
}

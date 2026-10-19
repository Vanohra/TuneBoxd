import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fetchUserDiary } from '../api/diary.js';
import { fetchUserReviews } from '../api/reviews.js';
import { fetchFollowers, fetchFollowing, fetchProfile } from '../api/users.js';
import Avatar from './Avatar.jsx';
import CoverArt from './CoverArt.jsx';
import DiaryList from './DiaryList.jsx';
import FollowButton from './FollowButton.jsx';
import { CalendarIcon, LockIcon, MailIcon } from './Icons.jsx';
import ReviewCard from './ReviewCard.jsx';
import { StarRating } from './StarRating.jsx';
import { EmptyState, ErrorState, Loading } from './Status.jsx';
import UserList from './UserList.jsx';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'diary', label: 'Diary' },
  { id: 'lists', label: 'Lists' },
  { id: 'following', label: 'Following' },
  { id: 'followers', label: 'Followers' },
];

function formatMemberSince(isoDate) {
  if (!isoDate) return null;
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Loads a user's reviews once and shares them between the Overview and Reviews tabs. */
function useUserReviews(username) {
  const [reviews, setReviews] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => {
    setError(null);
    fetchUserReviews(username)
      .then(setReviews)
      .catch(setError);
  }, [username]);
  useEffect(() => {
    setReviews(null);
    load();
  }, [load]);
  return { reviews, error, reload: load };
}

function RecentlyReviewed({ reviews, error, isOwnProfile, username }) {
  return (
    <section className="card">
      <h2 className="section-title">Recently Reviewed</h2>
      {error ? (
        <p className="empty-text">{error.message}</p>
      ) : !reviews ? (
        <Loading inline />
      ) : reviews.length === 0 ? (
        <>
          <div className="album-row album-row-empty" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="album-card">
                <div className="album-cover album-cover-empty" />
                <span className="skeleton skeleton-title" />
                <span className="skeleton skeleton-sub" />
              </div>
            ))}
          </div>
          <p className="empty-text">
            {isOwnProfile ? 'You haven’t' : `@${username} hasn’t`} reviewed anything yet.
            {isOwnProfile && (
              <>
                {' '}
                <Link to="/search">Find an album to review →</Link>
              </>
            )}
          </p>
        </>
      ) : (
        <div className="album-row album-row-filled">
          {reviews.slice(0, 5).map((review) => (
            <Link key={review.id} to={`/reviews/${review.id}`} className="album-card album-link">
              <CoverArt src={review.target.coverUrl} seed={review.target.mbid} alt={`${review.target.title} cover`} />
              <span className="album-card-title">{review.target.title}</span>
              <span className="album-card-sub">{review.target.artistName}</span>
              <StarRating rating={review.rating} size="sm" />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewsPanel({ reviews, error, reload, isOwnProfile, username }) {
  return (
    <section className="card">
      <h2 className="section-title">Reviews</h2>
      {error ? (
        <ErrorState title="Couldn’t load reviews" message={error.message} onRetry={reload} />
      ) : !reviews ? (
        <Loading inline label="Loading reviews…" />
      ) : reviews.length === 0 ? (
        <EmptyState
          title="No reviews yet"
          action={
            isOwnProfile && (
              <Link to="/search" className="btn btn-outline btn-sm">
                Find music to review
              </Link>
            )
          }
        >
          {isOwnProfile ? 'Reviews you write will show up here.' : `@${username} hasn’t written any reviews yet.`}
        </EmptyState>
      ) : (
        <div className="review-list">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} showTarget onDeleted={reload} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Diary tab. Private diaries come back from the API as 403, never as data. */
function DiaryPanel({ username, isOwnProfile }) {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    fetchUserDiary(username)
      .then((data) => !cancelled && setState({ status: 'done', data }))
      .catch((error) => !cancelled && setState({ status: 'error', error }));
    return () => {
      cancelled = true;
    };
  }, [username]);

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="section-title">Diary</h2>
        {isOwnProfile && (
          <Link to="/diary" className="btn btn-outline btn-sm">
            Manage diary
          </Link>
        )}
      </div>
      {state.status === 'loading' && <Loading inline label="Loading diary…" />}
      {state.status === 'error' &&
        (state.error.status === 403 ? (
          <div className="empty-state">
            <LockIcon size={28} />
            <p className="empty-state-title">This diary is private</p>
            <p className="empty-text">Only @{username} can see their listening history.</p>
          </div>
        ) : (
          <ErrorState title="Couldn’t load diary" message={state.error.message} />
        ))}
      {state.status === 'done' &&
        (state.data.entries.length === 0 ? (
          <EmptyState title="No diary entries yet">
            {isOwnProfile ? 'Log what you listen to from any album page.' : `@${username} hasn’t logged any listens yet.`}
          </EmptyState>
        ) : (
          <>
            {isOwnProfile && state.data.visibility === 'private' && (
              <p className="muted small private-note">
                <LockIcon size={14} /> Your diary is private. Only you can see this.
              </p>
            )}
            <DiaryList entries={state.data.entries} />
          </>
        ))}
    </section>
  );
}

function EmptyPanel({ title, children }) {
  return (
    <section className="card">
      <h2 className="section-title">{title}</h2>
      <p className="empty-text">{children}</p>
    </section>
  );
}

/** Loads and shows the follower/following list for the active tab. */
function FollowList({ username, kind, isOwnProfile, onFollowChange }) {
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setUsers(null);
    setError('');
    (kind === 'followers' ? fetchFollowers(username) : fetchFollowing(username))
      .then((list) => !cancelled && setUsers(list))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [username, kind]);

  const subject = isOwnProfile ? 'You' : `@${username}`;
  const emptyMessage =
    kind === 'followers'
      ? `${isOwnProfile ? 'You don’t' : `@${username} doesn’t`} have any followers yet.`
      : `${subject} ${isOwnProfile ? 'aren’t' : 'isn’t'} following anyone yet.`;

  return (
    <section className="card">
      <h2 className="section-title">{kind === 'followers' ? 'Followers' : 'Following'}</h2>
      {error ? (
        <p className="empty-text">{error}</p>
      ) : (
        <UserList users={users} emptyMessage={emptyMessage} onFollowChange={onFollowChange} />
      )}
      {isOwnProfile && kind === 'following' && (
        <p className="list-footer">
          <Link to="/community">Find people to follow →</Link>
        </p>
      )}
    </section>
  );
}

/**
 * Letterboxd-style profile: header (avatar, name, handle, stats, bio), tabs,
 * and tab content. Used for both your own profile and other members' profiles.
 * `email` is only passed in for your own profile; it is never public.
 */
export default function ProfileView({ username, email }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = TABS.some((tab) => tab.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const userReviews = useUserReviews(username);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await fetchProfile(username));
      setLoadError(null);
    } catch (err) {
      setLoadError(err);
    }
  }, [username]);

  useEffect(() => {
    setProfile(null);
    loadProfile();
  }, [loadProfile]);

  function selectTab(tabId) {
    setSearchParams(tabId === 'overview' ? {} : { tab: tabId }, { replace: true });
  }

  if (loadError) {
    return (
      <section className="card narrow center">
        <h1 className="page-title">{loadError.status === 404 ? 'User not found' : 'Something went wrong'}</h1>
        <p>{loadError.status === 404 ? `There’s no TuneBoxd member called @${username}.` : loadError.message}</p>
        <Link to="/community" className="btn btn-outline">
          Browse members
        </Link>
      </section>
    );
  }

  if (!profile) {
    return (
      <div className="loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading profile…
      </div>
    );
  }

  const { stats } = profile;
  const memberSince = formatMemberSince(profile.createdAt);
  const statItems = [
    { id: 'reviews', value: stats.reviews, label: stats.reviews === 1 ? 'Review' : 'Reviews' },
    ...(stats.diaryEntries == null ? [] : [{ id: 'diary', value: stats.diaryEntries, label: 'Diary' }]),
    { id: 'followers', value: stats.followers, label: stats.followers === 1 ? 'Follower' : 'Followers' },
    { id: 'following', value: stats.following, label: 'Following' },
  ];

  return (
    <div className="profile">
      <section className="profile-card">
        <div className="profile-header">
          <Avatar username={profile.username} src={profile.avatarUrl} size="xl" />

          <div className="profile-info">
            <h1 className="profile-name">{profile.displayName || profile.username}</h1>
            <p className="profile-handle">@{profile.username}</p>

            <ul className="profile-stats">
              {statItems.map((item) => (
                <li key={item.id}>
                  <button type="button" className="stat" onClick={() => selectTab(item.id)}>
                    <span className="stat-value">{item.value}</span>
                    <span className="stat-label">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>

            {profile.bio && <p className="profile-bio">{profile.bio}</p>}

            <ul className="profile-meta">
              {email && (
                <li>
                  <MailIcon size={15} />
                  {email}
                </li>
              )}
              {memberSince && (
                <li>
                  <CalendarIcon size={15} />
                  Member since {memberSince}
                </li>
              )}
            </ul>
          </div>

          <div className="profile-actions">
            {profile.isOwnProfile ? (
              <Link to="/profile/edit" className="btn btn-outline">
                Edit Profile
              </Link>
            ) : (
              <FollowButton
                username={profile.username}
                isFollowing={profile.isFollowing}
                onChange={(_, updated) => setProfile(updated)}
              />
            )}
          </div>
        </div>

        <nav className="tabs" aria-label="Profile sections">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab${activeTab === tab.id ? ' is-active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => selectTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </section>

      {activeTab === 'overview' && (
        <RecentlyReviewed {...userReviews} isOwnProfile={profile.isOwnProfile} username={profile.username} />
      )}

      {activeTab === 'reviews' && (
        <ReviewsPanel
          {...userReviews}
          reload={() => {
            userReviews.reload();
            loadProfile();
          }}
          isOwnProfile={profile.isOwnProfile}
          username={profile.username}
        />
      )}

      {activeTab === 'diary' && <DiaryPanel username={profile.username} isOwnProfile={profile.isOwnProfile} />}

      {activeTab === 'lists' && <EmptyPanel title="Lists">No lists yet. Custom music lists are coming soon.</EmptyPanel>}

      {(activeTab === 'following' || activeTab === 'followers') && (
        <FollowList
          key={activeTab}
          username={profile.username}
          kind={activeTab}
          isOwnProfile={profile.isOwnProfile}
          onFollowChange={loadProfile}
        />
      )}
    </div>
  );
}

import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import { GuestOnlyRoute, ProtectedRoute } from './components/RouteGuards.jsx';
import Sidebar from './components/Sidebar.jsx';
import AlbumPage from './pages/AlbumPage.jsx';
import ArtistPage from './pages/ArtistPage.jsx';
import Community from './pages/Community.jsx';
import Diary from './pages/Diary.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Logout from './pages/Logout.jsx';
import NotFound from './pages/NotFound.jsx';
import Profile from './pages/Profile.jsx';
import ReviewPage from './pages/ReviewPage.jsx';
import Search from './pages/Search.jsx';
import SignUp from './pages/SignUp.jsx';
import SongPage from './pages/SongPage.jsx';
import UserProfile from './pages/UserProfile.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-column">
        <Navbar />
        <main className="page">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/logout" element={<Logout />} />
            <Route path="/community" element={<Community />} />
            <Route path="/u/:username" element={<UserProfile />} />

            {/* Music discovery and reviews are public; writing needs a session (checked by the API). */}
            <Route path="/search" element={<Search />} />
            <Route path="/album/:mbid" element={<AlbumPage />} />
            <Route path="/artist/:mbid" element={<ArtistPage />} />
            <Route path="/song/:mbid" element={<SongPage />} />
            <Route path="/reviews/:id" element={<ReviewPage />} />

            <Route element={<GuestOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<EditProfile />} />
              <Route path="/diary" element={<Diary />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

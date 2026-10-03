import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import { GuestOnlyRoute, ProtectedRoute } from './components/RouteGuards.jsx';
import Sidebar from './components/Sidebar.jsx';
import Community from './pages/Community.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Logout from './pages/Logout.jsx';
import NotFound from './pages/NotFound.jsx';
import Profile from './pages/Profile.jsx';
import SignUp from './pages/SignUp.jsx';
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

            <Route element={<GuestOnlyRoute />}>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/edit" element={<EditProfile />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

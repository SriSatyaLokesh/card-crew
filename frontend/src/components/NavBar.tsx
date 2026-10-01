import { NavLink, Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

function NavBar() {
  const { profile, signOut } = useAuth();

  return (
    <header className="nav-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="nav-bar">
        <NavLink className="nav-brand" to="/" aria-label="Card Crew home">Card Crew</NavLink>
        <span className="nav-kicker">Trusted resource network</span>
      </div>
      <nav className="nav-links">
        <NavLink to="/" end>
          <span className="nav-link-icon" aria-hidden="true">🔍</span>
          <span>Search</span>
        </NavLink>
        <NavLink to="/cards">
          <span className="nav-link-icon" aria-hidden="true">💳</span>
          <span>My Cards</span>
        </NavLink>
        <NavLink to="/network">
          <span className="nav-link-icon" aria-hidden="true">👥</span>
          <span>Network</span>
        </NavLink>
        <NavLink to="/requests">
          <span className="nav-link-icon" aria-hidden="true">📬</span>
          <span>Requests</span>
        </NavLink>
        <NavLink to="/profile">
          <span className="nav-link-icon" aria-hidden="true">⚙️</span>
          <span>Profile</span>
        </NavLink>
      </nav>
      <div className="nav-user">
        <Link to="/profile" className="nav-user-profile-link" title="Open Profile Management">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="nav-avatar-img" />
          ) : (
            <span className="nav-avatar" aria-hidden="true">
              {profile?.display_name?.slice(0, 1).toUpperCase() ?? "?"}
            </span>
          )}
          <div className="nav-user-meta">
            <span className="nav-user-name">{profile?.display_name ?? "..."}</span>
            <span className="nav-user-handle">Manage Account</span>
          </div>
        </Link>
        <button
          className="button button-quiet nav-signout-btn"
          type="button"
          onClick={() => void signOut()}
          title="Sign out of Card Crew"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

export { NavBar };

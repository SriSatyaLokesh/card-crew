import { NavLink } from "react-router-dom";

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
          <span>Search</span>
        </NavLink>
        <NavLink to="/cards"><span>My Cards</span></NavLink>
        <NavLink to="/network"><span>Network</span></NavLink>
        <NavLink to="/requests"><span>Requests</span></NavLink>
      </nav>
      <div className="nav-user">
        <span className="nav-avatar" aria-hidden="true">{profile?.display_name?.slice(0, 1).toUpperCase() ?? "?"}</span>
        <span className="nav-user-name">{profile?.display_name ?? "..."}</span>
        <button className="button button-quiet" type="button" onClick={() => void signOut()}>Sign out</button>
      </div>
    </header>
  );
}

export { NavBar };

import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthHook";
import { USER } from "../assets/icons";

function Navbar() {
  const { email, isAuthenticated, signOut } = useAuth();
  return (
    <div className="navbar">
      <Link to={"/"}>Home</Link>
      <Link to={"/info"}>Information</Link>
      {isAuthenticated ? (
        <div className="navbar__user">
          <label htmlFor="user-btn">
            {USER()} {email.replace(/@.*/, "")}
          </label>
          <input id="user-btn" type="checkbox" />
          <div className="navbar__user--container">
            <p onClick={signOut}>Sign Out</p>
          </div>
        </div>
      ) : (
        <a href={"/auth"}>Register</a>
      )}
    </div>
  );
}

export default Navbar;

import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthHook";
import peccy from "../assets/peccy.png";
import logo from "../assets/logo.svg";
import Drawer from "@mui/material/Drawer";
import { MENU } from "../assets/icons";

function Navbar() {
  const { email, isAuthenticated, signOut } = useAuth();
  const username = localStorage.getItem("username");

  const [open, setOpen] = useState(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  return (
    <>
      <div className="navbar">
        <Link to={"/"}>
          <img className="navbar__logo" src={logo} alt="Bahrain Twin logo" />
        </Link>
        <div className="navbar__menu">
          <Link to={"/info"}>Information</Link>
          <Link to={"/environment"}>Environment</Link>
        </div>
        <div className="navbar__auth">
          {isAuthenticated ? (
            <div className="navbar__user">
              <label htmlFor="user-btn">
                <img src={peccy} alt="profile picture" />
                {username ? username : email.replace(/@.*/, "")}
              </label>
              <input id="user-btn" type="checkbox" />
              <div className="navbar__user--container">
                <p onClick={signOut}>Sign Out</p>
              </div>
            </div>
          ) : (
            <a href={"/auth"}>Register</a>
          )}
          <span className="navbar__drawer--toggle" onClick={toggleDrawer(true)}>
            {MENU()}
          </span>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <Drawer
        className="navbar__drawer"
        open={open}
        onClose={toggleDrawer(false)}
      >
        <div className="navbar__drawer--menu">
          <Link to={"/"}>
            <img className="navbar__logo" src={logo} alt="Bahrain Twin logo" />
          </Link>
          <Link to={"/info"}>Information</Link>
          <Link to={"/environment"}>Environment</Link>
          {isAuthenticated ? (
            <div className="navbar__user">
              <label htmlFor="user-btn2">
                <img src={peccy} alt="profile picture" />
                {username ? username : email.replace(/@.*/, "")}
              </label>
              <input id="user-btn2" type="checkbox" />
              <div className="navbar__user--container">
                <p onClick={signOut}>Sign Out</p>
              </div>
            </div>
          ) : (
            <a href={"/auth"}>Register</a>
          )}
        </div>
      </Drawer>
    </>
  );
}

export default Navbar;

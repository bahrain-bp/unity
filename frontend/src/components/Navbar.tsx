import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthHook";
import tmpUserImg from "../assets/user.png";
import logo from "../assets/logo.svg";
import Drawer from "@mui/material/Drawer";
import { MENU } from "../assets/icons";
import { ImageClient } from "../services/api";

function Navbar() {
  const { email, isAuthenticated, signOut, userId, userRole } = useAuth();

  const [open, setOpen] = useState(false);
  const [userImg, setUserImg] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const getUserImg = async () => {
    try {
      const result = await ImageClient.get(
        `/visitor/me?userId=${userId}`
      );

      if (result.status === 200) {
        setUserImg(result.data.imageUrl);
        setUsername(result.data.name);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (userId) {
      getUserImg();
    }
  }, [userId]);

  return (
    <>
      <div className="navbar">
        <Link to={"/"}>
          <img className="navbar__logo" src={logo} alt="Bahrain Twin logo" />
        </Link>
        <div className="navbar__menu">
          <Link to={"/info"}>Information</Link>
          <Link to={"/environment"}>Environment</Link>
          {userRole === "admin" && <Link to={"/dashboard"}>Dashboard</Link>}
        </div>
        <div className="navbar__auth">
          {isAuthenticated ? (
            <div className="navbar__user">
              <label htmlFor="user-btn">
                <img src={userImg ?? tmpUserImg} alt="profile picture" />
                {username ? username : email.replace(/@.*/, "")}
              </label>
              <input id="user-btn" type="checkbox" />
              <div className="navbar__user--container">
                <p onClick={signOut}>Sign Out</p>
              </div>
            </div>
          ) : (
            <Link to={"/auth"}>Register</Link>
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
          {userRole === "admin" && (
            <Link to={"/dashboard"}>Dashboard</Link>
          )}
          {isAuthenticated ? (
            <div className="navbar__user">
              <label htmlFor="user-btn2">
                <img src={userImg ?? tmpUserImg} alt="profile picture" />
                {username ? username : email.replace(/@.*/, "")}
              </label>
              <input id="user-btn2" type="checkbox" />
              <div className="navbar__user--container">
                <p onClick={signOut}>Sign Out</p>
              </div>
            </div>
          ) : (
            <Link to={"/auth"}>Register</Link>
          )}
        </div>
      </Drawer>
    </>
  );
}

export default Navbar;

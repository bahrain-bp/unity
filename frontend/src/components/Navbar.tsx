import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthHook";
import tmpUserImg from "../assets/user.png";
import logo from "../assets/logo.svg";
import Drawer from "@mui/material/Drawer";
import { MENU } from "../assets/icons";
import { Client } from "../services/api";

import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  maxWidth: "400",
  minWidth: "500",
  maxHeight: "80vh",
  borderRadius: "2rem",
  overflowY: "scroll",
  border: "none",
  boxShadow: 24,
  p: 4,
};

function Navbar() {
  const { email, isAuthenticated, signOut, userId, userRole } = useAuth();

  const [open, setOpen] = useState(false);
  const [userImg, setUserImg] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const [openModal, setOpenModal] = useState(false);
  const handleOpen = () => setOpenModal(true);
  const handleClose = () => setOpenModal(false);

  const toggleDrawer = (newOpen: boolean) => () => {
    setOpen(newOpen);
  };

  const getUserImg = async () => {
    try {
      const result = await Client.get(`/visitor/me?userId=${userId}`);

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
              <label onClick={handleOpen} htmlFor="user-btn">
                <img src={userImg ?? tmpUserImg} alt="profile picture" />
                {username ? username : email.replace(/@.*/, "")}
              </label>
              <Modal
                aria-labelledby="transition-modal-title"
                aria-describedby="transition-modal-description"
                open={openModal}
                onClose={handleClose}
                closeAfterTransition
                slots={{ backdrop: Backdrop }}
                slotProps={{
                  backdrop: {
                    timeout: 500,
                  },
                }}
              >
                <Fade in={openModal}>
                  <Box sx={style} className="navbar__modal">
                    <img src={userImg ?? tmpUserImg} alt="profile picture" />
                    <div className="navbar__modal--info">
                      <p>{username ? username : email.replace(/@.*/, "")}</p>
                      <p>{email ? email : "Loading..."}</p>
                    </div>
                    <button className="btn" onClick={signOut}>
                      Sign Out
                    </button>
                  </Box>
                </Fade>
              </Modal>
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
          {userRole === "admin" && <Link to={"/dashboard"}>Dashboard</Link>}
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

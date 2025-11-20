import { useEffect, useState } from "react";
import InfoCard from "../components/InfoCard";
import {
  CLOCK,
  CLOUD,
  LOCATION,
  SHOP,
  RESTAURANT,
  HOTEL,
  ED,
} from "../assets/icons";
import { Link } from "react-router-dom";
import locations from "../assets/locations.json";
import blob1 from "../assets/blob1.png";
import blob2 from "../assets/blob2.png";
import blob3 from "../assets/blob3.png";
import gradientBlob from "../assets/gradient-blob2.png";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

function getTime() {
  const now = new Date();

  const hours = now.getHours();
  const minutes = now.getMinutes();

  const formattedHours = hours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");

  const currentTime24Hour = `${formattedHours}:${formattedMinutes}`;
  return currentTime24Hour;
}

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 800,
  // bgcolor: "background.paper",
  borderRadius: "2rem",
  border: "1px solid #fff",
  boxShadow: 24,
  p: 4,
};

function Info() {
  const [open, setOpen] = useState<boolean>(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const [loading, isLoading] = useState<boolean>(false);
  const [activeLocation, setActiveLocation] = useState<number>(0);

  function setCardIcon(locType: string): React.ReactNode {
    if (locType === "hotel") {
      return HOTEL();
    } else if (locType === "restaurant") {
      return RESTAURANT();
    } else if (locType === "shop") {
      return SHOP();
    }

    return LOCATION(); // optional fallback
  }

  return (
    <div className="info">
      {/* <img className="info__blob1" src={blob1} alt="blob1" />
      <img className="info__blob2" src={blob2} alt="blob2" />
      <img className="info__blob3" src={blob3} alt="blob3" /> */}
      <img className="info__gradient" src={gradientBlob} alt="blob3" />
      <div className="info__container">
        <h1>Start Exploring!</h1>
        <p>
          Discover your surroundings like never before. BAHTWIN guides you
          through interactive 3D spaces with real-time insights and personalized
          virtual assistance
        </p>
        <div className="info__container--btns">
          <Link to={"/"} className="button">
            {ED()}
            Enter 3D Evironment
            <div className="hoverEffect">
              <div></div>
            </div>
          </Link>
          <button onClick={handleOpen}>Show Nearby Services</button>
        </div>
      </div>
      <Modal
        aria-labelledby="transition-modal-title"
        aria-describedby="transition-modal-description"
        open={open}
        onClose={handleClose}
        className="locations_modal"
        closeAfterTransition
        slots={{ backdrop: Backdrop }}
        slotProps={{
          backdrop: {
            timeout: 500,
          },
        }}
      >
        <Fade in={open}>
          <Box sx={style}>
            <div className="info__locations">
              <h2>Nearby Services</h2>
              <iframe
                src={`https://www.google.com/maps/embed?pb=${locations[activeLocation].link}`}
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="info__locations--list">
                {locations.map((location, i) => {
                  return (
                    <InfoCard
                      id={i}
                      classes={`infocard__${location.type}${
                        activeLocation === i ? " infocard__active" : ""
                      }`}
                      icon={setCardIcon(location.type)}
                      content={location.name}
                      onClick={(id) => setActiveLocation(id)}
                    />
                  );
                })}
              </div>
            </div>
          </Box>
        </Fade>
      </Modal>
    </div>
  );
}

export default Info;

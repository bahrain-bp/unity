import { useState } from "react";
import InfoCard from "../components/InfoCard";
import {
  LOCATION,
  SHOP,
  RESTAURANT,
  HOTEL,
  ED,
  FILTER,
  X,
} from "../assets/icons";
import { Link } from "react-router-dom";
import locations from "../assets/locations.json";
// import gradientBlob from "../assets/gradient-blob2.png";
import Backdrop from "@mui/material/Backdrop";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import Fade from "@mui/material/Fade";

import OutlinedInput from "@mui/material/OutlinedInput";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import ListItemText from "@mui/material/ListItemText";
import Select from "@mui/material/Select";
import type { SelectChangeEvent } from "@mui/material/Select";
import Checkbox from "@mui/material/Checkbox";

const ITEM_HEIGHT = 42;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const names = ["hotel", "restaurant", "shop"];

const style = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "90vw",
  maxWidth: 800,
  maxHeight: "80vh",
  borderRadius: "2rem",
  overflowY: "scroll",
  border: "1px solid #fff",
  boxShadow: 24,
  p: 4,
};

function Info() {
  const [open, setOpen] = useState<boolean>(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const [filter, setFilter] = useState<string[]>([]);

  const handleChange = (event: SelectChangeEvent<typeof filter>) => {
    const {
      target: { value },
    } = event;
    setFilter(
      // On autofill we get a stringified value.
      typeof value === "string" ? value.split(",") : value
    );
  };

  const [activeLocation, setActiveLocation] = useState<string>("The Avenues");

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
      {/* <img className="info__gradient" src={gradientBlob} alt="blob3" /> */}
      <span className="info__gradient" />
      <div className="info__container">
        <h1>Start Exploring!</h1>
        <p>
          Discover your surroundings like never before. BAHTWIN guides you
          through interactive 3D spaces with real-time insights and personalized
          virtual assistance
        </p>
        <div className="info__container--btns">
          <Link to={"/environment"} className="btn">
            {ED()}
            Enter 3D Evironment
            {/* <div className="hoverEffect">
              <div></div>
            </div> */}
          </Link>
          <button className="btn" onClick={handleOpen}>Show Nearby Services</button>
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
              <h2>
                Nearby Services <span onClick={handleClose}>{X()}</span>
              </h2>
              <iframe
                src={`https://www.google.com/maps/embed?pb=${
                  locations.find((loc) => loc.name === activeLocation)?.link
                }`}
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <FormControl sx={{ m: 1, width: "100%" }}>
                <InputLabel id="demo-multiple-checkbox-label">
                  {FILTER()} Filter
                </InputLabel>
                <Select
                  labelId="demo-multiple-checkbox-label"
                  id="demo-multiple-checkbox"
                  multiple
                  value={filter}
                  onChange={handleChange}
                  input={<OutlinedInput label="Filter" />}
                  renderValue={(selected) => selected.join(", ")}
                  MenuProps={MenuProps}
                >
                  {names.map((name) => (
                    <MenuItem key={name} value={name}>
                      <Checkbox checked={filter.includes(name)} />
                      <ListItemText primary={name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <div className="info__locations--list">
                {locations
                  .filter(
                    (location) =>
                      filter.length === 0 || filter.includes(location.type)
                  )
                  .map((location) => {
                    return (
                      <InfoCard
                        classes={`infocard__${location.type}${
                          activeLocation === location.name
                            ? " infocard__active"
                            : ""
                        }`}
                        name={location.name}
                        icon={setCardIcon(location.type)}
                        content={location.name}
                        onClick={() => setActiveLocation(location.name)}
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

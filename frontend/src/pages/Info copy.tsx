import { useEffect, useState } from "react";
import InfoCard from "../components/InfoCard";
import {
  CLOCK,
  CLOUD,
  LOCATION,
  SHOP,
  RESTAURANT,
  HOTEL,
} from "../assets/icons";
import { Link } from "react-router-dom";
import locations from "../assets/locations.json";

function getTime() {
  const now = new Date();

  const hours = now.getHours();
  const minutes = now.getMinutes();

  const formattedHours = hours.toString().padStart(2, "0");
  const formattedMinutes = minutes.toString().padStart(2, "0");

  const currentTime24Hour = `${formattedHours}:${formattedMinutes}`;
  return currentTime24Hour;
}

function Info() {
  const [tempreture, setTempreture] = useState<string>("");
  const [loading, isLoading] = useState<boolean>(false);
  const [activeLocation, setActiveLocation] = useState<number>(0);

  useEffect(() => {
    isLoading(true);
    fetch(
      "http://api.weatherapi.com/v1/current.json?key=5f725f71d6c449889bc131608251211&q=Manama"
    )
      .then((res) => res.json())
      .then((data) => {
        setTempreture(data.current.temp_c);
        isLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        isLoading(false);
        setTempreture("--");
      });
  }, []);

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
      <div className="info__container">
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
        <div className="info__map">
          <h2>AWS Bahrain Office</h2>
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3266.8708029830345!2d50.580711269165995!3d26.250041502683594!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3e49a5eeff168107%3A0x9d80348df1a5c82d!2sArcapita!5e0!3m2!1sen!2sbh!4v1763457357026!5m2!1sen!2sbh"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />

          <InfoCard
            classes="infocard__purple"
            icon={LOCATION()}
            content="Acrapita, Second Floor"
          />
          <InfoCard
            classes="infocard__blue"
            icon={CLOUD()}
            content={loading ? "--°" : parseInt(tempreture) + "°"}
          />
          <InfoCard
            classes="infocard__green"
            icon={CLOCK()}
            content={getTime()}
          />
        </div>
        <Link to="/">Start your journey!</Link>
      </div>
    </div>
  );
}

export default Info;

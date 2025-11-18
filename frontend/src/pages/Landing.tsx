import { Link } from "react-router-dom";

import { ED, NAVIGATION, VA } from "../assets/icons";
import Feature from "../components/Feature";
import Step from "../components/Step";
import polytechnic from "../assets/polytechnic.png";
import aws from "../assets/aws.png";
import tamkeen from "../assets/tamkeen.png";
import unity from "../assets/unity.png";

function Landing() {
  return (
    <div className="landing">
      <div className="landing__hero">
        <span className="landing__hero--circle" />
        <div className="landing__hero--heading">
          <h1>Reimagining</h1> <h1>Visitor</h1> <h1>Experience</h1>{" "}
          <h1>Through</h1> <h1>Intelligent</h1> <h1>Virtual</h1>{" "}
          <h1>Guidance.</h1>
        </div>

        <p>
          Discover your surroundings like never before. BAHTWIN guides you
          through interactive 3D spaces with real-time insights and personalized
          virtual assistance.
        </p>
        <Link to="/info">Explore Now!</Link>
      </div>
      <section>
        <h2>Why BAHTWIN</h2>
        <p className="section__description">
          Every BAHTWIN feature is crafted to make exploration effortless,
          engaging, and intelligent — transforming how people experience digital
          environments.
        </p>
        <div className="landing__features">
          <Feature
            icon={NAVIGATION()}
            title="Smart Navigation System"
            content="Find your way with precision using BAHTWIN's advanced wayfinding technology"
          />
          <Feature
            icon={ED()}
            title="Immersive 3D Environment"
            content="Explore real-world spaces in stunning 3D with smooth navigation and realistic design"
          />
          <Feature
            icon={VA()}
            title="Intelligent Virtual Assistant"
            content="Meet Picky, your smart companion powered by AI and natural language processing"
          />
        </div>
      </section>
      <section>
        <h2>How It Works</h2>
        <p className="section__description">
          Every BAHTWIN feature is crafted to make exploration effortless,
          engaging, and intelligent — transforming how people experience digital
          environments.
        </p>
        <div className="landing__steps">
          <Step
            number={1}
            title="Enter the 3D Environment"
            content="Users begin their journey by accessing the immersive digital twin of the AWS Bahrain office. The environment loads seamlessly through a web browser"
          />
          <Step
            number={2}
            title="Complete the Virtual Check-In"
            content="Upon reaching the virtual reception area, users are guided through a simulated security and verification process"
          />
          <Step
            number={3}
            title="Explore and Interact"
            content="Once inside, users can freely roam the digital office — exploring departments, meeting rooms, safety points, and nearby amenities"
          />
          <span className="step__line1" />
          <span className="step__line2" />
        </div>
      </section>
      <section>
        <h2>Partners & Collaborators</h2>
        <p>
          Lorem Ipsum is simply dummy text of the printing and typesetting
          industry
        </p>
        <div className="landing__partners">
          <img src={tamkeen} alt="tamkeen logo" />
          <img src={aws} alt="aws logo" />
          <img src={unity} alt="unity logo" />
          <img src={polytechnic} alt="polytechnic logo" />
        </div>
      </section>
    </div>
  );
}

export default Landing;

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/all";

type FeatureProps = {
  title: string;
  content: string;
  icon: React.ReactNode;
};

function Feature({ title, content, icon }: FeatureProps) {
  gsap.registerPlugin(ScrollTrigger);

  useEffect(() => {

    gsap.fromTo(
      ".feature",
      { opacity: 0 },
      {
        opacity: 1,
        duration: 0.5,
        stagger: 0.2,
        scrollTrigger: {
          trigger: ".feature",
          start: "top 80%",
        },
      }
    );
  }, []);
  return (
    <div className="feature">
      <span className="feature__icon">{icon}</span>
      <h3 className="feature__title">{title}</h3>
      <p className="feature__content">{content}</p>
    </div>
  );
}

export default Feature;

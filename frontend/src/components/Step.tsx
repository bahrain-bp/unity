import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/all";

type StepProps = {
  title: string;
  content: string;
  number: number;
};

function Step({ title, content, number }: StepProps) {
  gsap.registerPlugin(ScrollTrigger);

  useEffect(() => {
    const TL = gsap.timeline({
      scrollTrigger: {
        trigger: ".landing__steps",
        start: "top 80%",
      },
    });

    TL.fromTo(
      ".step1 .step__number",
      { opacity: 0 },
      { opacity: 1, duration: 1 }
    )
      .fromTo(".step1 h3", { opacity: 0 }, { opacity: 1, duration: 2 }, "-=0.8")
      .fromTo(
        ".step1 p",
        { y: 0, opacity: 0 },
        { y: 0, opacity: 1, duration: 2 },
        "-=1.9"
      )
      .fromTo(
        ".step__line1",
        { scaleX: "0", opacity: 0 },
        { scaleX: "1", opacity: 1, duration: 1 },
        "-=1.9"
      )
      .fromTo(
        ".step1",
        { "--line-scale": 0, "--line-opacity": 0 },
        { "--line-scale": 1, "--line-opacity": 1, duration: 1 },
        "-=1.9"
      )
      .fromTo(
        ".step2 .step__number",
        { opacity: 0 },
        { opacity: 1, duration: 1 },
        "-=1.5"
      )
      .fromTo(".step2 h3", { opacity: 0 }, { opacity: 1, duration: 2 }, "-=1.2")
      .fromTo(
        ".step2 p",
        { y: 0, opacity: 0 },
        { y: 0, opacity: 1, duration: 2 },
        "-=1.9"
      )
      .fromTo(
        ".step__line2",
        { scaleX: "0", opacity: 0 },
        { scaleX: "1", opacity: 1, duration: 1 },
        "-=1.9"
      )
      .fromTo(
        ".step2",
        { "--line-scale": 0, "--line-opacity": 0 },
        { "--line-scale": 1, "--line-opacity": 1, duration: 1 },
        "-=1.9"
      )
      .fromTo(
        ".step3 .step__number",
        { opacity: 0 },
        { opacity: 1, duration: 1 },
        "-=1.5"
      )
      .fromTo(".step3 h3", { opacity: 0 }, { opacity: 1, duration: 2 }, "-=1.2")
      .fromTo(
        ".step3 p",
        { y: 0, opacity: 0 },
        { y: 0, opacity: 1, duration: 2 },
        "-=1.9"
      );
  }, []);

  return (
    <div className={`step step${number}`}>
      <span className="step__number">{number}</span>
      <h3 className="step__title">{title}</h3>
      <p className="step__content">{content}</p>
    </div>
  );
}

export default Step;

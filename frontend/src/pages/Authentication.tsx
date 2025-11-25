import { useState } from "react";
import { MAIL, EYEC, EYEO, LOCK } from "../assets/icons";

function Authentication() {
  const [showPass1, setShowPass1] = useState<boolean>(false);
  const [showPass2, setShowPass2] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<boolean>(false);

  return (
    <div className="auth-sec">
      <div className="auth">
        <div className="auth__logo">
          <h2>Register</h2>
        </div>
        <div className="auth__mode">
          <span
            style={{ transform: `translateX(${authMode ? "100%" : "0%"})` }}
            className="auth__mode--shade"
          />
          <p
            onClick={() => setAuthMode(false)}
            className={!authMode ? "active" : ""}
          >
            Login
          </p>
          <p
            onClick={() => setAuthMode(true)}
            className={authMode ? "active" : ""}
          >
            Sign Up
          </p>
        </div>
        <form className="auth__form">
          <label htmlFor="email" className="auth__form--label">
            Email Address
          </label>
          <div className="auth__form--input">
            {MAIL()}
            <input
              type="email"
              className="auth__form--input"
              placeholder="Enter your email"
              id="email"
            />
          </div>
  

          <label htmlFor="password" className="auth__form--label">
            Password
          </label>
          <div className="auth__form--input">
            {LOCK()}
            <input
              type={showPass1 ? "text" : "password"}
              className="auth__form--input"
              placeholder="Create a password"
              id="password"
            />
            <span onClick={() => setShowPass1(!showPass1)}>
              {showPass1 ? EYEC() : EYEO()}
            </span>
          </div>
          {authMode && (
            <>
              <label htmlFor="confirm" className="auth__form--label">
                Confirm password
              </label>
              <div className="auth__form--input">
                {LOCK()}
                <input
                  type={showPass2 ? "text" : "password"}
                  className="auth__form--input"
                  placeholder="Confirm your password"
                  id="confirm"
                />
                <span onClick={() => setShowPass2(!showPass2)}>
                  {showPass2 ? EYEC() : EYEO()}
                </span>
              </div>
            </>
          )}
        </form>
        <button className="auth__button btn">Get Started</button>
      </div>
    </div>
  );
}

export default Authentication;
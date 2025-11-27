import { useState, useEffect, useRef } from "react";
import { MAIL, EYEC, EYEO, LOCK, IMAGE, CAMERA } from "../assets/icons";
import imagePlaceholder from "../assets/image.svg";

function Authentication() {
  const [showPass1, setShowPass1] = useState<boolean>(false);
  const [showPass2, setShowPass2] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<boolean>(true);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | ArrayBuffer | null>(
    null
  );

  const filePickerRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!file) return;

    const fileReader = new FileReader();
    fileReader.onload = () => {
      setPreviewUrl(fileReader.result);
    };
    fileReader.readAsDataURL(file);
  }, [file]);

  const pickImageHandler = () => {
    filePickerRef.current?.click();
  };

  const fileChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    setFile(event.target.files[0]);
  };

  return (
    <div className="auth-sec">
      <div className="auth">
        <div className="auth__logo">
          <h2>{authMode ? "Registration" : "Welcome back!"}</h2>
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
          {authMode && (
            <>
              <label htmlFor="email" className="auth__form--label">
                Profile Picture
              </label>
              <input
                ref={filePickerRef}
                style={{ display: "none" }}
                type="file"
                accept="image/*"
                onChange={fileChangeHandler}
                name="image"
              />
              <div className="auth__form--upload">
                {previewUrl ? (
                  <div
                    className="auth__form--profilePicture"
                    onClick={pickImageHandler}
                  >
                    <img
                      src={
                        previewUrl ? previewUrl.toString() : imagePlaceholder
                      }
                      alt="Preview"
                    />
                    <span>{CAMERA()}</span>
                  </div>
                ) : (
                  <span
                    onClick={pickImageHandler}
                    className="auth__form--uploadPlaceholder"
                  >
                    {IMAGE()}
                    <p>Upload your image here!</p>
                  </span>
                )}
              </div>
            </>
          )}
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
        <button className="auth__button btn">{authMode ? "Get Started" : "Login"}</button>
      </div>
    </div>
  );
}

export default Authentication;

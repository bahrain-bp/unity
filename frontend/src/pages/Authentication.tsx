import { useState, useEffect, useRef } from "react";
import {
  MAIL,
  EYEC,
  EYEO,
  LOCK,
  IMAGE,
  CAMERA,
  SUCCESS,
  ERROR,
  USER,
} from "../assets/icons";
import imagePlaceholder from "../assets/image.svg";
import { useAuth } from "../auth/AuthHook";
import { useNavigate } from "react-router-dom";
import CodeInputs from "../components/CodeInputs";
import Message from "../components/Message";
import { ImageClient } from "../services/api";

function Authentication() {
  const [showPass1, setShowPass1] = useState<boolean>(false);
  const [showPass2, setShowPass2] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<boolean>(true);
  // const [isSignedUp, setIsSignedUp] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [showVerification, setShowVerification] = useState(false);
  const [needsPasswordChange, setNeedsPasswordChange] = useState(false)
  
  const navigate = useNavigate();
  const { signUp, confirmSignUp, signIn, changePassword } = useAuth();

  const [account, setAccount] = useState({
    email: "",
    password: "",
    confirmPassword: "",
  });

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
    const file = event.target.files?.[0];
    setFile(event.target.files[0]);
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const changeAuthMode = (mode: boolean) => {
    setError("");
    setMessage("");
    setShowPass1(false);
    setShowPass2(false);
    setAuthMode(mode);
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;

    setAccount((prev) => {
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  const handleSubmit = async (event: React.ChangeEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authMode) {
      if (!userId) {
        handleSignup();
      } else {
        handleImageUpload(userId);
      }
    } else {
      handleSignIn();
    }
  };

  const handleSignIn = async () => {
    setError("");
    setMessage("");
    setLoading(true);

    if (needsPasswordChange) {
    const result = await changePassword(account.password);
    
    if (result.success) {
      navigate("/");
    } else {
      setError(result.message);
    }
  } else {
    const result = await signIn(account.email, account.password);

    if (result.success) {
      navigate("/");
    } else if (result.message === "NEW_PASSWORD_REQUIRED") {
      setNeedsPasswordChange(true);
      setError("");
      setMessage("Please set a new password");
    } else {
      setError(result.message);
    }
  }

  setLoading(false);
  };

  const handleSignup = async () => {
    setError("");
    setMessage("");

    if (account.password !== account.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (account.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (username.length < 1) {
      setError("Please enter a username");
      return;
    }

    if (!file) {
      setError("Please upload an image");
      return;
    }

    setLoading(true);
    const result = await signUp(account.email, account.password);
    console.log(result);

    if (result.success) {
      // setMessage(result.message);
      setUserId(result.userId ?? null);
      if (result.userId) {
        handleImageUpload(result.userId);
      }
      setError("");
      localStorage.setItem("username", username);
      //setShowVerification(true);
    } else {
      setError(result.message);
    }

    // setLoading(false);
  };

  const handleImageUpload = async (userId: string) => {
    console.log(userId);
    
    setLoading(true);
    try {
      console.log(userId);
      await ImageClient.post("/visitor/register", {
        userId: userId,
        name: username,
        email: account.email,
        image_data: imageBase64,
      });
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong. Please try to upload another image");
      setLoading(false);
      return;
    }
    setLoading(false);
    setShowVerification(true);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    const result = await confirmSignUp(account.email, verificationCode);

    if (result.success) {
      setMessage("Email verified! Redirecting to sign in...");
      setTimeout(() => {
        setShowVerification(false);
        setAuthMode(false);
        setError("");
        setMessage("");
        navigate("/auth");
      }, 2000);
    } else {
      setError(result.message);
    }

    setLoading(false);
  };

  if (showVerification) {
    return (
      <div className="auth-sec">
        <div className="auth auth__verification">
          <h2>Verify Your Email</h2>
          <p>We sent a verification code to {account.email}</p>
          <form onSubmit={handleVerify}>
            <CodeInputs
              length={6}
              onChange={(value) => setVerificationCode(value)}
            />
            {/* <input
              type="email"
              className="auth__form--input"
              placeholder="Enter your email"
              id="email"
              name="email"
              onChange={handleChange}
            /> */}

            {error && <Message type="error" icon={ERROR()} message={error} />}
            {message && (
              <Message type="success" icon={SUCCESS()} message={message} />
            )}

            <button
              className="auth__button btn"
              type="submit"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Verify Email"}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
            onClick={() => changeAuthMode(false)}
            className={!authMode ? "active" : ""}
          >
            Login
          </p>
          <p
            onClick={() => changeAuthMode(true)}
            className={authMode ? "active" : ""}
          >
            Sign Up
          </p>
        </div>
        <form onSubmit={handleSubmit} className="auth__form">
          {error && <Message type="error" icon={ERROR()} message={error} />}
          {message && (
            <Message type="success" icon={SUCCESS()} message={message} />
          )}
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
          {authMode && (
            <>
              <label htmlFor="username" className="auth__form--label">
                Username
              </label>
              <div className="auth__form--input">
                {USER()}
                <input
                  type="text"
                  className="auth__form--input"
                  placeholder="Enter your username"
                  id="username"
                  name="username"
                  onChange={(e) => setUsername(e.target.value)}
                />
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
              name="email"
              onChange={handleChange}
            />
          </div>

          <label htmlFor="password" className="auth__form--label">
            {needsPasswordChange ? "New Password" : "Password"}
          </label>
          <div className="auth__form--input">
            {LOCK()}
            <input
              type={showPass1 ? "text" : "password"}
              className="auth__form--input"
              placeholder="Create a password"
              name="password"
              id="password"
              onChange={handleChange}
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
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  id="confirm"
                  onChange={handleChange}
                />
                <span onClick={() => setShowPass2(!showPass2)}>
                  {showPass2 ? EYEC() : EYEO()}
                </span>
              </div>
            </>
          )}
          <button className="auth__button btn">
            {loading ? "Loading..." : authMode ? "Get Started" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Authentication;
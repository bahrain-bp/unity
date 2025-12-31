import React, { useState, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import {
  FaCamera,
  FaUpload,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";
import { ImageClient } from "../services/api";
import DashboardLayout from "./dashboard/DashboardLayout";

const Arrival: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"camera" | "upload">("camera");
  const [cameraOpen, setCameraOpen] = useState(false);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /* =========================
     Open Camera
  ========================== */
  const openCamera = () => {
    setCameraOpen(true);
    setImageBase64(null);
  };

  /* =========================
     Capture Photo
  ========================== */
  const capturePhoto = useCallback(() => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setImageBase64(imageSrc.split(",")[1]);
      setCameraOpen(false);
    }
  }, []);

  /* =========================
     Upload Image
  ========================== */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(",")[1];
      setImageBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  /* =========================
     Submit Image
  ========================== */
  const handleSubmit = async () => {
    if (!imageBase64) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await ImageClient.post("/visitor/arrival", {
        image_data: imageBase64,
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout className="visitor-arrival" header="Visitor Arrival">
      <div className="auth-sec invite-page">
        <div className="auth">
          <div className="auth__logo auth__logo--center">
            <h2>Visitor Arrival</h2>
            <p className="auth__description">
              Please ask the visitor to stand in front of the camera or upload
              their photo to verify their identity before granting access to the
              facility.
            </p>
          </div>

          {/* MODE TOGGLE */}
          <div className="auth__mode">
            <span
              className="auth__mode--shade"
              style={{
                transform: `translateX(${mode === "upload" ? "100%" : "0%"})`,
              }}
            />
            <p
              className={mode === "camera" ? "active" : ""}
              onClick={() => {
                setMode("camera");
                setCameraOpen(false);
              }}
            >
              Camera
            </p>
            <p
              className={mode === "upload" ? "active" : ""}
              onClick={() => {
                setMode("upload");
                setCameraOpen(false);
              }}
            >
              Upload
            </p>
          </div>

          <div className="auth__form">
            {/* Messages */}
            {loading && (
              <div className="message processing">
                <span className="spinner" /> Processing...
              </div>
            )}

            {error && <div className="message error">⚠️ {error}</div>}

            {result?.status === "match" && (
              <div className="message success">
                <FaCheckCircle /> Welcome, {result.name}
              </div>
            )}

            {result?.error && (
              <div className="message error">
                <FaTimesCircle /> {result.error}
              </div>
            )}

            {/* CAMERA MODE */}
            {mode === "camera" && (
              <>
                <label className="auth__form--label">Camera</label>

                {!cameraOpen && (
                  <button
                    type="button"
                    className="auth__button btn"
                    onClick={openCamera}
                  >
                    <FaCamera /> Open Camera
                  </button>
                )}

                {cameraOpen && (
                  <>
                    <div className="auth__form--upload webcam-box">
                      <Webcam
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: "user" }}
                      />
                    </div>

                    <button
                      type="button"
                      className="auth__button btn"
                      onClick={capturePhoto}
                    >
                      Capture Photo
                    </button>
                  </>
                )}

                {/* PREVIEW AFTER CAPTURE */}
                {!cameraOpen && imageBase64 && (
                  <div className="auth__form--upload preview-box">
                    <img
                      src={`data:image/jpeg;base64,${imageBase64}`}
                      alt="Captured"
                    />
                  </div>
                )}
              </>
            )}

            {/* UPLOAD MODE */}
            {mode === "upload" && (
              <>
                <label className="auth__form--label">Upload Image</label>

                <div
                  className="auth__form--upload"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleImageUpload}
                  />

                  <div className="upload-content">
                    <FaUpload className="upload-icon" />
                    <p>
                      {imageBase64 ? "Image selected" : "Click to upload image"}
                    </p>
                  </div>
                </div>

                {/* PREVIEW AFTER UPLOAD */}
                {imageBase64 && (
                  <div className="auth__form--upload preview-box">
                    <img
                      src={`data:image/jpeg;base64,${imageBase64}`}
                      alt="Uploaded"
                    />
                  </div>
                )}
              </>
            )}

            {/* SUBMIT */}
            {imageBase64 && (
              <button
                type="button"
                className="auth__button btn"
                onClick={handleSubmit}
                disabled={loading}
              >
                Scan & Verify
              </button>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Arrival;

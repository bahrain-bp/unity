import React, { useState, useRef, useCallback } from "react";
import { ImageClient } from "../services/api";
import Webcam from "react-webcam";
import { FaCamera, FaUpload, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import "../../sass/_visitorArrival.scss";

const Arrival: React.FC = () => {
  const webcamRef = useRef<Webcam>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showWebcam, setShowWebcam] = useState(false);
  const [loading, setLoading] = useState(false);

  // Capture a photo from the webcam
  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        const base64 = imageSrc.split(",")[1];
        setImageBase64(base64);
        setShowWebcam(false);
      }
    }
  }, []);

  // Upload photo from device → convert to Base64
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      setImageBase64(base64);
      setShowWebcam(false);
    };
    reader.readAsDataURL(file);
  };

  // Submit the photo to your API
  const handleSubmit = async () => {
    if (!imageBase64) return;
    setLoading(true);
    try {
      const response = await ImageClient.post("/visitor/arrival", {
        image_data: imageBase64,
      });
      setResult(response.data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="arrival-container">
      <h1>Visitor Arrival</h1>
      <p className="instructions">
        Please take a photo using your camera or upload an image from your device.
      </p>

      {/* Webcam / Photo Preview */}
      <div className="photo-section">
        {showWebcam && (
          <Webcam
            audio={false}
            ref={webcamRef}
            screenshotFormat="image/jpeg"
            width={400}
            height={300}
            videoConstraints={{ facingMode: "user" }}
          />
        )}

        {!showWebcam && imageBase64 && (
          <div className="photo-preview">
            <h3>Photo Preview:</h3>
            <img
              src={`data:image/jpeg;base64,${imageBase64}`}
              alt="Preview"
              className="preview-img"
            />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="button-row">
        {!showWebcam && (
          <button className="primary" onClick={() => setShowWebcam(true)}>
            <FaCamera /> Take Photo
          </button>
        )}

        <div className="upload-wrapper">
          <input
            id="file-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            style={{ display: "none" }}
          />
          <label htmlFor="file-upload">
            <div className="primary upload-btn">
              <FaUpload /> Upload Photo
            </div>
          </label>
      </div>

        {showWebcam && (
          <button className="secondary" onClick={capturePhoto}>
            Capture Photo
          </button>
        )}

        {imageBase64 && (
          <button
            className="submit"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Processing..." : "Upload & Scan"}
          </button>
        )}
      </div>

      {/* Result Boxes */}
      {result && result.status === "match" && (
  <div className="result-box success">
    <FaCheckCircle className="icon" />
    <h2>Welcome, {result.name}!</h2>
    <p>Access Granted</p>
  </div>
)}

      {result && result.error && (
          
        <div className="result-box failure">
          <FaTimesCircle className="icon" />
          <h2>{result.error}</h2>
        </div>
      )}

      {error && (
        <div className="result-box warning">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default Arrival;

import React, { useState, useRef } from "react";
import axios from "axios";
import { FaUpload } from "react-icons/fa";
import "../../../sass/_visitorInvite.scss";
import DashboardLayout from "./DashboardLayout";

function VisitorTestPage() {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "processing" | "">("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setMessage("");
      setMessageType("");

      if (mode === "single") {
        if (!name.trim() || !email.trim() || !visitDate || !visitTime) {
          throw new Error("Please fill in all fields");
        }

        setMessage("Sending invitation...");
        setMessageType("processing");

        const response = await axios.post(
          "https://vljyjl7oae.execute-api.us-east-1.amazonaws.com/prod/admin/registerVisitorIndividual",
          {
            name,
            email,
            visitDateTime: `${visitDate}T${visitTime}`,
          }
        );

        setMessage(response.data.message || "Invitation sent successfully");
        setMessageType("success");

        // Reset fields
        setName("");
        setEmail("");
        setVisitDate("");
        setVisitTime("");
      } else {
        if (!csvFile) {
          throw new Error("Please upload a CSV file");
        }
        if (!csvFile.name.endsWith(".csv")) {
          throw new Error("Invalid file type. Please upload a CSV file");
        }

        // Show processing message immediately
        setMessage("CSV file processing...");
        setMessageType("processing");

        // Convert file to Base64
        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(csvFile);
        });

        const response = await axios.post(
          "https://vljyjl7oae.execute-api.us-east-1.amazonaws.com/prod/admin/registerVisitorBulk",
          { file: fileBase64 }
        );

        if (response.data.error) {
          const errors = Array.isArray(response.data.error)
            ? response.data.error.join("\n")
            : response.data.error;
          setMessage(errors);
          setMessageType("error");
        } else {
          setMessage(response.data.message || "CSV uploaded successfully");
          setMessageType("success");
          setCsvFile(null);
        }
      }
    } catch (err: any) {
      // Handle API errors properly
      if (err.response) {
        // API responded with an error status code
        const apiError = err.response.data?.error || err.response.data?.message || err.message;
        setMessage(apiError);
        setMessageType("error");
      } else if (err.request) {
        // Request was made but no response
        setMessage("No response from server");
        setMessageType("error");
      } else {
        // Something else went wrong
        setMessage(err.message || "Something went wrong");
        setMessageType("error");
      }
    }
  };

  return (
    <DashboardLayout className="dashboard__invite" header="Invite Visitor">
    <div className="auth-sec invite-page">
      <div className="auth">
        <div className="auth__logo">
          <h2>Invite Visitor</h2>
        </div>

        {/* MODE TOGGLE */}
        <div className="auth__mode">
          <span
            className="auth__mode--shade"
            style={{ transform: `translateX(${mode === "bulk" ? "100%" : "0%"})` }}
          />
          <p className={mode === "single" ? "active" : ""} onClick={() => setMode("single")}>
            Individual
          </p>
          <p className={mode === "bulk" ? "active" : ""} onClick={() => setMode("bulk")}>
            Bulk
          </p>
        </div>

        <form className="auth__form" onSubmit={handleSubmit}>
          {message && (
            <div className={`message ${messageType}`}>
              {messageType === "processing" && <span className="spinner" />} {message}
            </div>
          )}

          {mode === "single" && (
            <>
              <label className="auth__form--label">Name</label>
              <div className="auth__form--input">
                <input
                  type="text"
                  placeholder="Visitor name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <label className="auth__form--label">Email</label>
              <div className="auth__form--input">
                <input
                  type="email"
                  placeholder="Visitor email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <label className="auth__form--label">Visit Date</label>
              <div className="auth__form--input">
                <input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                />
              </div>

              <label className="auth__form--label">Visit Time</label>
              <div className="auth__form--input">
                <input
                  type="time"
                  value={visitTime}
                  onChange={(e) => setVisitTime(e.target.value)}
                />
              </div>
            </>
          )}

          {mode === "bulk" && (
            <>
              <label className="auth__form--label">Upload CSV File</label>
              <div
                className="auth__form--upload"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={(e) => setCsvFile(e.target.files ? e.target.files[0] : null)}
                />
                <div className="upload-content">
                  <FaUpload className="upload-icon" />
                  <p>{csvFile ? csvFile.name : "Click to upload CSV"}</p>
                </div>
              </div>
            </>
          )}

          <button
            className="auth__button btn"
            type="submit"
            disabled={messageType === "processing"}
          >
            {mode === "single" ? "Send Invitation" : "Upload CSV"}
          </button>
        </form>
      </div>
    </div>
    </DashboardLayout>
  );
}

export default VisitorTestPage;

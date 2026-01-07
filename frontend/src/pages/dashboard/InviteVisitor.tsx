import React, { useState, useRef } from "react";
import { FaUpload } from "react-icons/fa";
import DashboardLayout from "./DashboardLayout";
import "../../../sass/dashboard/_visitorInvite.scss";
import { ImageClient } from "../../services/api";

function VisitorTestPage() {
  const [mode, setMode] = useState<"single" | "bulk">("single");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [visitTime, setVisitTime] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] =
    useState<"success" | "error" | "processing" | "">("");
  const [bulkErrors, setBulkErrors] = useState<
    { row: number; field: string; message: string; hint?: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setMessage("");
      setMessageType("");
      setBulkErrors([]);

      if (mode === "single") {
        if (!name.trim() || !email.trim() || !visitDate || !visitTime) {
          throw new Error("Please fill in all fields");
        }

        setMessage("Sending invitation...");
        setMessageType("processing");

        const response = await ImageClient.post(
          "admin/registerVisitorIndividual",
          {
            name,
            email,
            visitDateTime: `${visitDate}T${visitTime}`,
          }
        );

        setMessage(response.data.message || "Invitation sent successfully");
        setMessageType("success");

        setName("");
        setEmail("");
        setVisitDate("");
        setVisitTime("");
      } else {
        if (!csvFile) throw new Error("Please upload a CSV file");
        if (!csvFile.name.endsWith(".csv"))
          throw new Error("Invalid file type. Please upload a CSV file");

        setMessage("CSV file processing...");
        setMessageType("processing");

        const fileBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve((reader.result as string).split(",")[1]);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(csvFile);
        });

        const response = await ImageClient.post(
          "/admin/registerVisitorBulk",
          { file: fileBase64 }
        );

        // SUCCESS
        setMessage(response.data.message || "CSV uploaded successfully");
        setMessageType("success");
        setBulkErrors([]);

        // 🔹 RESET FILE INPUT so you can upload again
        setCsvFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err: any) {
      if (err.response && err.response.data) {
        const apiError = err.response.data.error;
        if (Array.isArray(apiError)) {
          // Structured CSV validation errors
          setMessage(
            "The uploaded CSV contains errors. No invitations were sent. Please correct the following:"
          );
          setBulkErrors(apiError);
        } else if (typeof apiError === "string") {
          setMessage(apiError);
          setBulkErrors([]);
        } else {
          setMessage("Unknown API error");
          setBulkErrors([]);
        }
        setMessageType("error");
        // 🔹 RESET FILE INPUT after errors too
        setCsvFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else if (err.request) {
        setMessage("No response from server");
        setMessageType("error");
      } else {
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
              style={{
                transform: `translateX(${mode === "bulk" ? "100%" : "0%"})`,
              }}
            />
            <p
              className={mode === "single" ? "active" : ""}
              onClick={() => {
                setMode("single");
                setMessage("");
                setBulkErrors([]);
              }}
            >
              Individual
            </p>
            <p
              className={mode === "bulk" ? "active" : ""}
              onClick={() => {
                setMode("bulk");
                setMessage("");
                setBulkErrors([]);
              }}
            >
              Bulk
            </p>
          </div>

          <form className="auth__form" onSubmit={handleSubmit}>
            {/* MAIN MESSAGE */}
            {message && (
              <div className={`message ${messageType}`}>
                {messageType === "processing" && <span className="spinner" />}
                {message}
              </div>
            )}

            {/* BULK CSV ERRORS */}
            {messageType === "error" && bulkErrors.length > 0 && (
              <div className="bulk-errors">
                <ul>
                  {bulkErrors.map((err: any, index: number) => (
                    <li key={index}>
                      <strong>Row {err.row}</strong> — <strong>{err.field}</strong>:{" "}
                      {err.message}
                      {err.hint && <span className="hint"> ({err.hint})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* SINGLE MODE */}
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

            {/* BULK MODE */}
            {mode === "bulk" && (
              <>
                {/* CSV INFO */}
                <div className="csv-info">
                  <p className="csv-info__title">CSV format requirements</p>
                  <ul>
                    <li>
                      <strong>name</strong> – Visitor full name
                    </li>
                    <li>
                      <strong>email</strong> – Valid email address
                    </li>
                    <li>
                      <strong>visitDate</strong> – MM/DD/YYYY
                    </li>
                    <li>
                      <strong>visitTime</strong> – h:mm AM/PM
                    </li>
                  </ul>

                  <pre className="csv-example">
name,email,visitDate,visitTime<br />
Abby,example@email.com,12/22/2025,5:30 PM
                  </pre>
                </div>

                {/* UPLOAD */}
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
                    onChange={(e) =>
                      setCsvFile(e.target.files ? e.target.files[0] : null)
                    }
                  />
                  <div className="upload-content">
                    <FaUpload className="upload-icon" />
                    <p>{csvFile ? csvFile.name : "Click to upload CSV"}</p>
                  </div>
                </div>
              </>
            )}

            {/* SUBMIT */}
            <button
              className="auth__button btn"
              type="submit"
              disabled={
                messageType === "processing" ||
                (mode === "bulk" && !csvFile)
              }
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

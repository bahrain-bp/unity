import React, { useState, useRef } from "react";
import DashboardLayout from "./DashboardLayout";
import { ERROR, FILE, FILES } from "../../assets/icons";
import Message from "../../components/Message";

interface UploadProgress {
  filename: string;
  progress: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

function UploadUnity() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);

  const pickFilesHandler = () => {
    filePickerRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    const kb = 1024;
    const mb = kb * 1024;
    const gb = mb * 1024;

    if (bytes >= gb) {
      return (bytes / gb).toFixed(2).replace(/\.00$/, "") + " GB";
    }
    if (bytes >= mb) {
      return (bytes / mb).toFixed(2).replace(/\.00$/, "") + " MB";
    }
    if (bytes >= kb) {
      return (bytes / kb).toFixed(2).replace(/\.00$/, "") + " KB";
    }
    return bytes + "b";
  };

  const renameFile = (filename: string): string => {
    const parts = filename.split(".");
    parts.shift();
    const suffix = parts.join(".");
    return `BAHTWIN_BUILD.${suffix}`;
  }
  

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 4) {
      setError("Maximum 4 files allowed");
      e.target.value = "";
      return;
    }
    setFiles(e.target.files);
    setError(null);
    setUploadProgress([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!files || files.length === 0) {
      setError("Please select at least one file");
      return;
    }

    if (files.length > 4) {
      setError("Maximum 4 files allowed");
      return;
    }

    setUploading(true);
    setError(null);

    // Progress bar initialization
    const initialProgress: UploadProgress[] = Array.from(files).map((file) => ({
      filename: file.name,
      progress: 0,
      status: "pending",
    }));
    setUploadProgress(initialProgress);

    try {
      // STEP 1 — Request presigned URLs
      const fileRequests = Array.from(files).map((file) => ({
        filename: renameFile(file.name),
        contentType: file.type || "application/octet-stream",
        size: file.size,
      }));

      const response = await fetch(import.meta.env.VITE_WEBGL_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: fileRequests }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch presigned URLs`);
      }

      const data = await response.json();

      if (!data.urls || !Array.isArray(data.urls)) {
        throw new Error("Invalid backend response: missing urls[]");
      }

      const urls = data.urls;

      // STEP 2 — Upload each file using the returned order
      const uploadPromises = urls.map(async (urlData: any, index: number) => {
        const file = files[index];

        setUploadProgress((prev) =>
          prev.map((p, i) => (i === index ? { ...p, status: "uploading" } : p))
        );

        try {
          await uploadFileToS3(
            file,
            urlData.uploadUrl,
            urlData.headers["Content-Type"],
            (progress) => {
              setUploadProgress((prev) =>
                prev.map((p, i) => (i === index ? { ...p, progress } : p))
              );
            }
          );

          setUploadProgress((prev) =>
            prev.map((p, i) =>
              i === index ? { ...p, progress: 100, status: "completed" } : p
            )
          );
        } catch (err) {
          setUploadProgress((prev) =>
            prev.map((p, i) =>
              i === index
                ? {
                    ...p,
                    status: "error",
                    error: err instanceof Error ? err.message : "Upload failed",
                  }
                : p
            )
          );
          throw err;
        }
      });

      await Promise.all(uploadPromises);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout className="dashboard__webgl" header="Upload WebGL Build">
      {error && <Message message={error} type="error" icon={ERROR()} />}

      <form onSubmit={handleSubmit}>
        <input
          ref={filePickerRef}
          type="file"
          multiple
          disabled={uploading}
          onChange={handleFileChange}
          accept=".js,.unityweb"
          style={{ display: "none" }}
        />
        <div className="dashboard__webgl--files" onClick={pickFilesHandler}>
          {files ? (
            <>
              {uploadProgress.length > 0 ? (
                <div className="dashboard__webgl--uploading">
                  {uploadProgress.map((item, i) => (
                    <div className="dashboard__webgl--file" key={i}>
                      <div className="dashboard__webgl--fileDetails">
                        {FILE()}
                        <span>{item.filename}</span>
                        <span>
                          {item.status === "completed"
                            ? "Completed"
                            : item.status === "error"
                            ? "Error!"
                            : `${Math.round(item.progress)}%`}
                        </span>
                      </div>
                      <div className="dashboard__webgl--progress-bg">
                        <div
                          className="dashboard__webgl--progress"
                          style={{
                            width: `${item.progress}%`,
                            backgroundColor:
                              item.status === "error"
                                ? "#e71010"
                                : item.status === "completed"
                                ? "#019426"
                                : "#ff8e3c",
                          }}
                        />
                      </div>
                      {item.error && (
                        <Message
                          message={item.error}
                          type="error"
                          icon={ERROR()}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {files &&
                    Array.from(files).map((file, i) => (
                      <div className="dashboard__webgl--fileDetails" key={i}>
                        {FILE()}
                        <span>{file.name}</span>
                        <span>{formatFileSize(file.size)}</span>
                      </div>
                    ))}
                </>
              )}
            </>
          ) : (
            <div className="dashboard__webgl--upload">
              {FILES()}
              <p>Click to choose files (Max 4)</p>
              <span>Supported formats: JS, UNITYWEB </span>
            </div>
          )}
        </div>
        <button
          className="dashboard__webgl--btn btn btn-orange"
          type="submit"
          disabled={uploading || !files}
        >
          {uploading ? "Uploading..." : "Upload Files"}
        </button>
      </form>
    </DashboardLayout>
  );
}

// Upload file with progress tracking using PUT to presigned URL
async function uploadFileToS3(
  file: File,
  presignedUrl: string,
  contentType: string,
  onProgress: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(file);
  });
}

export default UploadUnity;

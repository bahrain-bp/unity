import { useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import type { ChangeEvent } from "react";
import DashboardLayout from "./DashboardLayout";
import { FILE, FILES, X } from "../../assets/icons";

// interface AuthContext {
//   token: string;
// }

// You'll need to import your auth context or pass it as a prop
// For now, I'm assuming you have an auth object available
// declare const auth: AuthContext;

function UploadUnity() {
  const filePickerRef = useRef<HTMLInputElement>(null);
  // const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // const navigate = useNavigate();

  const pickFilesHandler = () => {
    filePickerRef.current?.click();
  };

  useEffect(() => {
    if (!files || files.length === 0) {
      return;
    }

    const fileReaders: FileReader[] = [];

    files.forEach((file) => {
      const fileReader = new FileReader();
      fileReaders.push(fileReader);

      fileReader.readAsDataURL(file);
    });
  }, [files]);

  const pickedHandler = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const pickedFiles = Array.from(event.target.files);

      // Limit to 4 total files, including already selected files
      if (files.length + pickedFiles.length > 4) {
        setError("You can upload up to 4 files.");
        return;
      }

      const updatedFiles = [...pickedFiles];

      pickedFiles.forEach((file) => {
        updatedFiles.push(file);
      });

      setFiles(updatedFiles);
      setError(null);
    }
  };

  const uploadFilesHandler = async () => {
    const formData = new FormData();

    // Find the common letters
    let target_name = "";

    for (let i = 0; i < files[0].name.length; i++) {
      if (files[0].name[i] === files[1].name[i]) {
        target_name += files[0].name[i];
      }
    }

    // renaming each file BAHTWIN.**
    files.forEach((file) => {

      const renamedFile = new File(
        [file],
        file.name.replace(target_name, "BAHTWIN."),
        { type: file.type }
      );

      formData.append("files", renamedFile);
    });

    try {
      setIsLoading(true);
      // const response = await fetch(
      //   `${process.env.NEXT_PUBLIC_BE}/file/upload`,
      //   {
      //     method: "POST",
      //     headers: {
      //       "auth-token": auth.token,
      //     },
      //     body: formData,
      //   }
      // );

      // if (response.ok) {
      //   ////////////////////////////////
      //   navigate("/dashboard/files");
      //   ////////////////////////////////
      // } else {
      //   setIsLoading(false);
      //   throw new Error("File upload failed.");
      // }

      // const responseData = await response.json();
      // console.log("Uploaded successfully:", responseData);
      setFiles([]);
      // setPreviewUrls([]);
      setError(null);
      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const removeFile = (fileToRemove: File) => {
    const updatedFiles = files.filter((file) => file !== fileToRemove);
    setFiles(updatedFiles);
  };

  return (
    <DashboardLayout className="dashboard__webgl" header="Upload WebGL Files">
      <input
        ref={filePickerRef}
        style={{ display: "none" }}
        type="file"
        multiple
        onChange={pickedHandler}
        name="files"
        accept=".js,.unityweb"
      />
      <div
        className={`dashboard__webgl--files${
          files.length === 0 ? " flexCenter" : ""
        }`}
        onClick={pickFilesHandler}
      >
        {files.length > 0 ? (
          files.map((file, index) => (
            <div key={index} className="dashboard__webgl--file">
              {FILE()} {file.name}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(file);
                }}
                className="dashboard__webgl--file-close"
              >
                {X()}
              </span>
            </div>
          ))
        ) : (
          <div className="dashboard__webgl--upload">
            {FILES()}
            <p>Click to choose files (up to 4)</p>
            <span>Supported formats: JS, UNITYWEB </span>
          </div>
        )}
      </div>

      {error && (
        <p className="error" style={{ width: "fit-content" }}>
          {error}
        </p>
      )}
      {message && (
        <p className="success" style={{ width: "fit-content" }}>
          {message}
        </p>
      )}

      <button
        className="dashboard__webgl--btn btn btn-orange"
        onClick={uploadFilesHandler}
      >
        {isLoading ? "Loading..." : "Upload Files"}
      </button>
    </DashboardLayout>
  );
}

export default UploadUnity;

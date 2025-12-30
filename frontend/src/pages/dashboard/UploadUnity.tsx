import React, { useState } from 'react';

// ❗ Replace with your real API endpoint
const API_ENDPOINT = 'https://8o8yxjp901.execute-api.us-east-1.amazonaws.com/prod/generate-upload-urls';

interface UploadProgress {
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

function UploadUnity() {
  const [files, setFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 4) {
      setError('Maximum 4 files allowed');
      e.target.value = '';
      return;
    }
    setFiles(e.target.files);
    setError(null);
    setUploadProgress([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!files || files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    if (files.length > 4) {
      setError('Maximum 4 files allowed');
      return;
    }

    setUploading(true);
    setError(null);

    // Progress bar initialization
    const initialProgress: UploadProgress[] = Array.from(files).map(file => ({
      filename: file.name,
      progress: 0,
      status: 'pending',
    }));
    setUploadProgress(initialProgress);

    try {
      // STEP 1 — Request presigned URLs
      const fileRequests = Array.from(files).map(file => ({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      }));

      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileRequests }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch presigned URLs`);
      }

      const data = await response.json();

      if (!data.urls || !Array.isArray(data.urls)) {
        throw new Error('Invalid backend response: missing urls[]');
      }

      const urls = data.urls;

      // STEP 2 — Upload each file using the returned order
      const uploadPromises = urls.map(async (urlData: any, index: number) => {
        const file = files[index];

        setUploadProgress(prev =>
          prev.map((p, i) => (i === index ? { ...p, status: 'uploading' } : p))
        );

        try {
          await uploadFileToS3(
            file,
            urlData.uploadUrl,
            urlData.headers['Content-Type'],
            progress => {
              setUploadProgress(prev =>
                prev.map((p, i) =>
                  i === index ? { ...p, progress } : p
                )
              );
            }
          );

          setUploadProgress(prev =>
            prev.map((p, i) =>
              i === index ? { ...p, progress: 100, status: 'completed' } : p
            )
          );
        } catch (err) {
          setUploadProgress(prev =>
            prev.map((p, i) =>
              i === index
                ? {
                    ...p,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Upload failed',
                  }
                : p
            )
          );
          throw err;
        }
      });

      await Promise.all(uploadPromises);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-form">
      <h2>Upload Unity WebGL Build Files (Max 4)</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="file"
          multiple
          disabled={uploading}
          onChange={handleFileChange}
        />
        <button type="submit" disabled={uploading || !files}>
          {uploading ? 'Uploading...' : 'Upload Files'}
        </button>
      </form>

      {error && (
        <div style={{ color: 'red', marginTop: '10px' }}>{error}</div>
      )}

      {uploadProgress.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Progress</h3>
          {uploadProgress.map((item, i) => (
            <div key={i} style={{ marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.filename}</span>
                <span>
                  {item.status === 'completed'
                    ? '✓'
                    : item.status === 'error'
                    ? 'Error'
                    : `${Math.round(item.progress)}%`}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: '20px',
                  backgroundColor: '#eee',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  marginTop: '5px',
                }}
              >
                <div
                  style={{
                    width: `${item.progress}%`,
                    height: '100%',
                    backgroundColor:
                      item.status === 'error'
                        ? '#f44336'
                        : item.status === 'completed'
                        ? '#4caf50'
                        : '#2196f3',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              {item.error && (
                <div style={{ color: 'red', fontSize: '12px' }}>
                  {item.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status}`));
    });

    xhr.addEventListener('error', () => reject(new Error('Network error')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
}

export default UploadUnity;

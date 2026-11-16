import { useState } from "react";
import { Button, Field, Input, Progress, useToast } from "./ui";
import { uploadFile, isGithubConfigured } from "../lib/github";
import { useGithubSettings } from "../lib/settings";
import { GITHUB_CONFIG } from "../App";

const ACCEPT: Record<string, string> = {
  thumbnail: "image/*",
  banner: "image/*",
  image: "image/*",
  video: "video/*",
  pdf: "application/pdf",
};

export function MediaUploader({
  kind,
  value,
  onUploaded,
  label,
  hint,
}: {
  kind: "thumbnail" | "banner" | "video" | "pdf" | "image";
  value: string;
  onUploaded: (url: string) => void;
  label: string;
  hint?: string;
}) {
  const { push } = useToast();
  const { settings } = useGithubSettings(GITHUB_CONFIG);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const ready = isGithubConfigured(settings);

  async function upload() {
    if (!file) return;
    setError("");
    if (file.size >= 2 * 1024 * 1024 * 1024) {
      setError("GitHub release assets must be smaller than 2 GiB.");
      return;
    }
    setProgress(0);
    try {
      const result = await uploadFile(settings, file, kind, setProgress);
      onUploaded(result.url);
      push(`Uploaded to ${result.releaseTag || "GitHub Releases"}.`, "success");
      setFile(null);
    } catch (caught: any) {
      setError(caught?.message || "Upload failed.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="uploader">
      <Field label={label} hint={hint || "Paste a direct link, or upload a file to GitHub Releases."}>
        <Input
          value={value}
          onChange={(event) => onUploaded(event.target.value)}
          placeholder={`https://github.com/${settings.owner}/${settings.repo}/releases/download/…`}
        />
      </Field>

      {ready ? (
        <div className="uploader-row">
          <label className="file-pick">
            <input
              type="file"
              accept={ACCEPT[kind]}
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            <span>{file ? file.name : "Choose a file"}</span>
          </label>
          <Button
            size="sm"
            variant="secondary"
            onClick={upload}
            disabled={!file || progress !== null}
            loading={progress !== null}
          >
            Upload
          </Button>
        </div>
      ) : (
        <p className="muted small">
          Uploads are not configured yet. Add your token on the Settings page, or set{" "}
          <code>GITHUB_TOKEN</code> in <code>src/App.tsx</code>.
        </p>
      )}

      {progress !== null && (
        <div className="uploader-progress">
          <Progress value={progress} />
          <span className="muted small">{progress}% uploaded</span>
        </div>
      )}

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {value && (
        <a className="link small" href={value} target="_blank" rel="noreferrer">
          Preview current file →
        </a>
      )}
    </div>
  );
}

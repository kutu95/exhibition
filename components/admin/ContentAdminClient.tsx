"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { ChangeEvent, useMemo, useState } from "react";

import type { MediaFile, SiteContent } from "../../lib/supabase/types";
import styles from "./ContentAdminClient.module.css";

type SiteContentWithMedia = SiteContent & {
  media_files: MediaFile | null;
};

type ContentAdminClientProps = {
  initialContentRows: SiteContentWithMedia[];
  initialMediaFiles: MediaFile[];
};

type UploadResult = {
  success: boolean;
  media_file_id: string;
  url_path: string;
};

type TabKey = "text" | "media";
type MediaFilter = "all" | "image" | "video";

const contentGroups: Array<{ title: string; keys: string[] }> = [
  { title: "Hero", keys: ["hero_headline", "hero_subheadline", "hero_background_image", "hero_video"] },
  { title: "Holding Page", keys: ["holding_page_body"] },
  { title: "Story", keys: ["story_intro", "story_hero_image"] },
  { title: "Visit", keys: ["visit_hours", "visit_address", "visit_parking"] },
  {
    title: "Installations",
    keys: ["installation_cubarama", "installation_captain_godfrey_ai", "installation_drift"],
  },
  {
    title: "Locations",
    keys: ["location_calgardup_bay", "location_redgate_beach", "location_isaac_rock", "location_ss_georgette"],
  },
];

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const uploadWithProgress = (
  endpoint: "/api/admin/upload/image" | "/api/admin/upload/video",
  file: File,
  payload: { alt_text?: string; usage_note?: string },
  onProgress: (percent: number) => void,
): Promise<UploadResult> =>
  new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    if (payload.alt_text) {
      formData.append("alt_text", payload.alt_text);
    }
    if (payload.usage_note) {
      formData.append("usage_note", payload.usage_note);
    }

    const request = new XMLHttpRequest();
    request.open("POST", endpoint);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    };

    request.onload = () => {
      try {
        const parsed = JSON.parse(request.responseText) as UploadResult | { error: string };
        if (request.status >= 200 && request.status < 300 && "success" in parsed) {
          resolve(parsed);
          return;
        }
        const message = "error" in parsed ? parsed.error : "Upload failed.";
        reject(new Error(message));
      } catch {
        reject(new Error("Upload failed."));
      }
    };
    request.onerror = () => reject(new Error("Upload failed."));
    request.send(formData);
  });

const truncateFilename = (filename: string): string => {
  if (filename.length <= 32) return filename;
  return `${filename.slice(0, 12)}...${filename.slice(-14)}`;
};

function InlineEditableField({
  value,
  placeholder,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  onSave: (nextValue: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  const commit = async () => {
    setEditing(false);
    if (draft === (value ?? "")) return;
    await onSave(draft);
  };

  if (editing) {
    return (
      <input
        className={styles.inlineInput}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          void commit();
        }}
      />
    );
  }

  return (
    <button className={styles.inlineButton} type="button" onClick={() => setEditing(true)}>
      {value?.trim() ? value : <span className={styles.mutedText}>{placeholder}</span>}
    </button>
  );
}

function ContentEditBlock({
  row,
  onSaveText,
  onUploadAndLinkMedia,
  onRemoveLinkedMedia,
}: {
  row: SiteContentWithMedia;
  onSaveText: (key: string, contentValue: string) => Promise<void>;
  onUploadAndLinkMedia: (
    rowKey: string,
    file: File,
    endpoint: "/api/admin/upload/image" | "/api/admin/upload/video",
    onProgress: (progress: number) => void,
  ) => Promise<void>;
  onRemoveLinkedMedia: (rowKey: string) => Promise<void>;
}) {
  const [value, setValue] = useState(row.content_value ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const isTextual = row.content_type === "text" || row.content_type === "html";

  const saveText = async () => {
    setStatus("saving");
    setError(null);
    try {
      await onSaveText(row.content_key, value);
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "Failed to save.");
    }
  };

  const handleUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    endpoint: "/api/admin/upload/image" | "/api/admin/upload/video",
  ) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);
    try {
      await onUploadAndLinkMedia(row.content_key, file, endpoint, (progress) => setUploadProgress(progress));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const linkedMedia = row.media_files;

  return (
    <article className={styles.contentBlock}>
      <p className={styles.keyLabel}>{row.content_key}</p>

      {isTextual ? (
        <>
          <textarea
            className={styles.textarea}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            rows={4}
          />
          {row.content_type === "html" ? <p className={styles.note}>HTML supported</p> : null}
          <div className={styles.actionsRow}>
            <button className={styles.saveButton} type="button" onClick={() => void saveText()} disabled={status === "saving"}>
              {status === "saving" ? "Saving..." : "Save"}
            </button>
            {status === "saved" ? <span className={styles.saved}>Saved ✓</span> : null}
            {status === "error" && error ? <span className={styles.error}>{error}</span> : null}
          </div>
        </>
      ) : null}

      {row.content_type === "image" ? (
        <div className={styles.mediaEditor}>
          {linkedMedia ? (
            <div className={styles.linkedMedia}>
              <Image src={linkedMedia.url_path} alt={linkedMedia.alt_text ?? ""} width={142} height={80} className={styles.thumb} />
              <div>
                <p className={styles.mediaName}>{linkedMedia.filename}</p>
                <button
                  className={styles.removeButton}
                  type="button"
                  onClick={() => {
                    void onRemoveLinkedMedia(row.content_key);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.emptyState}>No image set</p>
          )}

          <label className={styles.uploadLabel}>
            Upload new image (max 5MB)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                void handleUpload(event, "/api/admin/upload/image");
              }}
              disabled={uploading}
            />
          </label>
          {uploading ? <p className={styles.progress}>Uploading {uploadProgress}%</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      ) : null}

      {row.content_type === "video" ? (
        <div className={styles.mediaEditor}>
          {linkedMedia ? (
            <div className={styles.linkedMedia}>
              <video className={styles.videoPreview} src={linkedMedia.url_path} controls />
              <div>
                <p className={styles.mediaName}>{linkedMedia.filename}</p>
                <p className={styles.mutedText}>{formatFileSize(linkedMedia.file_size_bytes)}</p>
                <button
                  className={styles.removeButton}
                  type="button"
                  onClick={() => {
                    void onRemoveLinkedMedia(row.content_key);
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <p className={styles.emptyState}>No video set</p>
          )}

          <label className={styles.uploadLabel}>
            Upload hero video (max 100MB)
            <input
              type="file"
              accept="video/mp4,video/webm"
              onChange={(event) => {
                void handleUpload(event, "/api/admin/upload/video");
              }}
              disabled={uploading}
            />
          </label>
          {uploading ? (
            <progress className={styles.progressBar} value={uploadProgress} max={100}>
              {uploadProgress}
            </progress>
          ) : null}
          {uploading ? <p className={styles.progress}>{uploadProgress}%</p> : null}
          <p className={styles.note}>
            For best results, export at 1920×1080, H.264, under 100MB. The video plays muted and looped as the hero
            background.
          </p>
          {error ? <p className={styles.error}>{error}</p> : null}
        </div>
      ) : null}
    </article>
  );
}

function MediaLibrary({
  mediaFiles,
  onUpdateMediaField,
  onDeleteMedia,
  onUploadLibraryMedia,
}: {
  mediaFiles: MediaFile[];
  onUpdateMediaField: (id: string, payload: { alt_text?: string; usage_note?: string }) => Promise<void>;
  onDeleteMedia: (id: string) => Promise<void>;
  onUploadLibraryMedia: (
    type: "image" | "video",
    file: File,
    payload: { alt_text?: string; usage_note?: string },
    onProgress: (progress: number) => void,
  ) => Promise<void>;
}) {
  const [filter, setFilter] = useState<MediaFilter>("all");
  const [uploadModalType, setUploadModalType] = useState<"image" | "video" | null>(null);
  const [usageNote, setUsageNote] = useState("");
  const [altText, setAltText] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredFiles = useMemo(() => {
    if (filter === "all") return mediaFiles;
    return mediaFiles.filter((file) => file.file_type === filter);
  }, [filter, mediaFiles]);

  const totalStorageBytes = mediaFiles.reduce((sum, file) => sum + file.file_size_bytes, 0);

  const handleLibraryUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !uploadModalType) return;

    setUploading(true);
    setError(null);
    setUploadProgress(0);
    try {
      await onUploadLibraryMedia(
        uploadModalType,
        file,
        { alt_text: altText, usage_note: usageNote },
        (progress) => setUploadProgress(progress),
      );
      setUploadModalType(null);
      setUsageNote("");
      setAltText("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <section className={styles.mediaTab}>
      <div className={styles.mediaTopRow}>
        <div>
          <p className={styles.storageSummary}>
            {mediaFiles.length} files · {formatFileSize(totalStorageBytes)}
          </p>
          <div className={styles.filters}>
            <button type="button" onClick={() => setFilter("all")} className={filter === "all" ? styles.activeFilter : ""}>
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter("image")}
              className={filter === "image" ? styles.activeFilter : ""}
            >
              Images
            </button>
            <button
              type="button"
              onClick={() => setFilter("video")}
              className={filter === "video" ? styles.activeFilter : ""}
            >
              Video
            </button>
          </div>
        </div>

        <div className={styles.uploadButtons}>
          <button type="button" onClick={() => setUploadModalType("image")}>
            Upload Image
          </button>
          <button type="button" onClick={() => setUploadModalType("video")}>
            Upload Video
          </button>
        </div>
      </div>

      {uploadModalType ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modal}>
            <h3>{uploadModalType === "image" ? "Upload Image" : "Upload Video"}</h3>
            <label>
              Usage note
              <input value={usageNote} onChange={(event) => setUsageNote(event.target.value)} />
            </label>
            {uploadModalType === "image" ? (
              <label>
                Alt text
                <input value={altText} onChange={(event) => setAltText(event.target.value)} />
              </label>
            ) : null}
            <label>
              File
              <input
                type="file"
                accept={uploadModalType === "image" ? "image/jpeg,image/png,image/webp" : "video/mp4,video/webm"}
                onChange={(event) => {
                  void handleLibraryUpload(event);
                }}
                disabled={uploading}
              />
            </label>
            {uploading ? <p className={styles.progress}>Uploading {uploadProgress}%</p> : null}
            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="button" onClick={() => setUploadModalType(null)} disabled={uploading}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      <div className={styles.mediaGrid}>
        {filteredFiles.map((file) => (
          <article className={styles.mediaCard} key={file.id}>
            {file.file_type === "image" ? (
              <Image src={file.url_path} alt={file.alt_text ?? ""} width={120} height={80} className={styles.libraryThumb} />
            ) : (
              <video className={styles.libraryThumb} src={file.url_path} muted loop playsInline />
            )}

            <p className={styles.mediaName} title={file.filename}>
              {truncateFilename(file.filename)}
            </p>
            <p className={styles.mutedText}>{formatFileSize(file.file_size_bytes)}</p>
            <p className={styles.mutedText}>{new Date(file.uploaded_at).toLocaleString()}</p>

            <div className={styles.metaField}>
              <span>Alt text</span>
              <InlineEditableField
                value={file.alt_text}
                placeholder="Click to add"
                onSave={async (nextValue) => onUpdateMediaField(file.id, { alt_text: nextValue })}
              />
            </div>

            <div className={styles.metaField}>
              <span>Usage note</span>
              <InlineEditableField
                value={file.usage_note}
                placeholder="Click to add"
                onSave={async (nextValue) => onUpdateMediaField(file.id, { usage_note: nextValue })}
              />
            </div>

            <button
              className={styles.urlPath}
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(file.url_path);
              }}
            >
              {file.url_path}
            </button>

            <button
              className={styles.deleteButton}
              type="button"
              onClick={() => {
                if (!window.confirm("Delete this file? This cannot be undone.")) return;
                void onDeleteMedia(file.id);
              }}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ContentAdminClient({ initialContentRows, initialMediaFiles }: ContentAdminClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [contentRows, setContentRows] = useState<SiteContentWithMedia[]>(initialContentRows);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>(initialMediaFiles);

  const currentTab = searchParams.get("tab") === "media" ? "media" : "text";

  const contentByKey = useMemo(() => {
    return new Map(contentRows.map((row) => [row.content_key, row]));
  }, [contentRows]);

  const updateContentRow = (contentKey: string, updates: Partial<SiteContentWithMedia>) => {
    setContentRows((rows) =>
      rows.map((row) => (row.content_key === contentKey ? { ...row, ...updates } : row)),
    );
  };

  const saveContentValue = async (key: string, contentValue: string) => {
    const response = await fetch(`/api/admin/content/${encodeURIComponent(key)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_value: contentValue }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to save content.");
    }
    const updated = (await response.json()) as SiteContent;
    updateContentRow(key, { content_value: updated.content_value, updated_at: updated.updated_at });
  };

  const uploadAndLinkMedia = async (
    rowKey: string,
    file: File,
    endpoint: "/api/admin/upload/image" | "/api/admin/upload/video",
    onProgress: (progress: number) => void,
  ) => {
    const uploadResponse = await uploadWithProgress(endpoint, file, { usage_note: rowKey }, onProgress);
    const patchResponse = await fetch(`/api/admin/content/${encodeURIComponent(rowKey)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_file_id: uploadResponse.media_file_id,
        content_value: uploadResponse.url_path,
      }),
    });

    if (!patchResponse.ok) {
      const body = (await patchResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to link media.");
    }

    const refreshedMedia = await fetch("/api/admin/media", { cache: "no-store" });
    let latestMedia: MediaFile[] = mediaFiles;
    if (refreshedMedia.ok) {
      latestMedia = (await refreshedMedia.json()) as MediaFile[];
      setMediaFiles(latestMedia);
    }

    const linkedMedia = latestMedia.find((item) => item.id === uploadResponse.media_file_id) ?? null;
    updateContentRow(rowKey, {
      media_file_id: uploadResponse.media_file_id,
      content_value: uploadResponse.url_path,
      media_files: linkedMedia,
    });
    router.refresh();
  };

  const removeLinkedMedia = async (rowKey: string) => {
    const response = await fetch(`/api/admin/content/${encodeURIComponent(rowKey)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_file_id: null, content_value: "" }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to unlink media.");
    }
    updateContentRow(rowKey, { media_file_id: null, content_value: "", media_files: null });
  };

  const updateMediaField = async (id: string, payload: { alt_text?: string; usage_note?: string }) => {
    const response = await fetch(`/api/admin/media/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to update media.");
    }
    const updated = (await response.json()) as MediaFile;
    setMediaFiles((current) => current.map((file) => (file.id === id ? updated : file)));
    setContentRows((rows) =>
      rows.map((row) => {
        if (row.media_file_id !== id) return row;
        return { ...row, media_files: updated };
      }),
    );
  };

  const deleteMedia = async (id: string) => {
    const response = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to delete media.");
    }

    setMediaFiles((current) => current.filter((file) => file.id !== id));
    setContentRows((rows) =>
      rows.map((row) => {
        if (row.media_file_id !== id) return row;
        return { ...row, media_file_id: null, content_value: "", media_files: null };
      }),
    );
  };

  const uploadLibraryMedia = async (
    type: "image" | "video",
    file: File,
    payload: { alt_text?: string; usage_note?: string },
    onProgress: (progress: number) => void,
  ) => {
    await uploadWithProgress(type === "image" ? "/api/admin/upload/image" : "/api/admin/upload/video", file, payload, onProgress);
    const response = await fetch("/api/admin/media", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Upload completed, but media list refresh failed.");
    }
    setMediaFiles((await response.json()) as MediaFile[]);
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1>Site Content</h1>
        <div className={styles.tabs}>
          <button
            type="button"
            className={currentTab === "text" ? styles.activeTab : ""}
            onClick={() => router.push("/admin/content")}
          >
            Text Content
          </button>
          <button
            type="button"
            className={currentTab === "media" ? styles.activeTab : ""}
            onClick={() => router.push("/admin/content?tab=media")}
          >
            Media Library
          </button>
        </div>
      </div>

      {currentTab === "text" ? (
        <div className={styles.groupList}>
          {contentGroups.map((group) => (
            <section key={group.title} className={styles.groupSection}>
              <h2>{group.title}</h2>
              <div className={styles.groupGrid}>
                {group.keys.map((key) => {
                  const row = contentByKey.get(key);
                  if (!row) {
                    return (
                      <article key={key} className={styles.contentBlock}>
                        <p className={styles.keyLabel}>{key}</p>
                        <p className={styles.mutedText}>Missing row in `site_content`.</p>
                      </article>
                    );
                  }
                  return (
                    <ContentEditBlock
                      key={row.id}
                      row={row}
                      onSaveText={saveContentValue}
                      onUploadAndLinkMedia={uploadAndLinkMedia}
                      onRemoveLinkedMedia={removeLinkedMedia}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <MediaLibrary
          mediaFiles={mediaFiles}
          onUpdateMediaField={updateMediaField}
          onDeleteMedia={deleteMedia}
          onUploadLibraryMedia={uploadLibraryMedia}
        />
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  Download,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FileUp,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { deleteResource, updateResource } from "@/app/creator/actions";
import { lessonResourceLinkSchema, type LessonResourceLink } from "@/lib/course-wizard";
import {
  ALLOWED_RESOURCE_TYPES,
  MAX_RESOURCE_BYTES,
  MAX_RESOURCE_MB,
} from "@/lib/upload-limits";

export interface AttachedCourseResource {
  id: string;
  lessonId: string | null;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export function formatResourceBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function detectResourceKindBadge(
  fileName: string,
  contentType: string
): {
  label: string;
  tone: "violet" | "sky" | "emerald" | "amber" | "default";
} {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || contentType.includes("pdf"))
    return { label: "PDF", tone: "violet" };
  if (ext === "zip" || contentType.includes("zip"))
    return { label: "ZIP", tone: "amber" };
  if (
    ["xls", "xlsx", "csv"].includes(ext) ||
    contentType.includes("spreadsheet") ||
    contentType.includes("csv")
  ) {
    return { label: ext.toUpperCase() || "SHEET", tone: "emerald" };
  }
  if (["doc", "docx"].includes(ext) || contentType.includes("word")) {
    return { label: ext.toUpperCase() || "DOC", tone: "sky" };
  }
  if (
    ["ppt", "pptx"].includes(ext) ||
    contentType.includes("presentation")
  ) {
    return { label: ext.toUpperCase() || "SLIDES", tone: "amber" };
  }
  if (["md", "txt"].includes(ext) || contentType.startsWith("text/")) {
    return { label: ext.toUpperCase() || "TEXT", tone: "default" };
  }
  return { label: (ext || "FILE").slice(0, 6).toUpperCase(), tone: "default" };
}

function ResourceFileIcon({
  fileName,
  contentType,
}: {
  fileName: string;
  contentType: string;
}) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "zip" || contentType.includes("zip")) {
    return <FileArchive className="size-4 text-amber-600" aria-hidden="true" />;
  }
  if (
    ["xls", "xlsx", "csv"].includes(ext) ||
    contentType.includes("spreadsheet") ||
    contentType.includes("csv")
  ) {
    return (
      <FileSpreadsheet className="size-4 text-emerald-600" aria-hidden="true" />
    );
  }
  return <FileText className="size-4 text-sky-600" aria-hidden="true" />;
}

/**
 * Infers a supported MIME type when browsers report empty `file.type` for `.md` or `.csv`.
 */
export function resolveResourceMimeType(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    zip: "application/zip",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] ?? (file.type || "application/octet-stream");
}

export function validateResourceFileClient(file: File): string | null {
  if (file.size <= 0) return "The selected file is empty.";
  if (file.size > MAX_RESOURCE_BYTES) {
    return `Resource exceeds the ${MAX_RESOURCE_MB} MB upload limit.`;
  }
  const mimeType = resolveResourceMimeType(file);
  if (!ALLOWED_RESOURCE_TYPES.includes(mimeType)) {
    return `Unsupported file type. Supported formats: PDF, ZIP, DOCX, XLSX, PPTX, CSV, TXT, MD (up to ${MAX_RESOURCE_MB} MB).`;
  }
  return null;
}

function makeLinkId(): string {
  return `lnk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

interface ResourcesLessonPanelProps {
  courseId: string;
  lessonId?: string | null;
  files: AttachedCourseResource[];
  onFilesChange?: (nextFiles: AttachedCourseResource[]) => void;
  links?: LessonResourceLink[];
  onLinksChange?: (nextLinks: LessonResourceLink[]) => void;
  allowExternalLinks?: boolean;
  disabled?: boolean;
}

export function ResourcesLessonPanel({
  courseId,
  lessonId = null,
  files,
  onFilesChange,
  links = [],
  onLinksChange,
  allowExternalLinks = true,
  disabled = false,
}: ResourcesLessonPanelProps) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileTitle, setFileTitle] = React.useState("");
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [fileSuccess, setFileSuccess] = React.useState<string | null>(null);

  const [editingFileId, setEditingFileId] = React.useState<string | null>(null);
  const [editingFileTitle, setEditingFileTitle] = React.useState("");
  const [busyFileId, setBusyFileId] = React.useState<string | null>(null);

  const [showAddLink, setShowAddLink] = React.useState(false);
  const [linkTitle, setLinkTitle] = React.useState("");
  const [linkUrl, setLinkUrl] = React.useState("");
  const [linkDescription, setLinkDescription] = React.useState("");
  const [linkError, setLinkError] = React.useState<string | null>(null);

  const [editingLinkId, setEditingLinkId] = React.useState<string | null>(null);
  const [editLinkDraft, setEditLinkDraft] =
    React.useState<LessonResourceLink | null>(null);

  function handleSelectFile(file: File | null) {
    setFileError(null);
    setFileSuccess(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationErr = validateResourceFileClient(file);
    if (validationErr) {
      setFileError(validationErr);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    if (!fileTitle.trim()) {
      setFileTitle(file.name.replace(/\.[a-z0-9]+$/i, ""));
    }
  }

  async function handleUploadFile() {
    if (!selectedFile || disabled) {
      setFileError("Choose a file to upload first.");
      return;
    }
    const cleanTitle = fileTitle.trim() || selectedFile.name;
    if (cleanTitle.length > 200) {
      setFileError("Resource title must be 200 characters or fewer.");
      return;
    }

    const validationErr = validateResourceFileClient(selectedFile);
    if (validationErr) {
      setFileError(validationErr);
      return;
    }

    const mimeType = resolveResourceMimeType(selectedFile);
    setUploadingFile(true);
    setFileError(null);
    setFileSuccess(null);

    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "upload",
          kind: "resource",
          courseId,
          lessonId: lessonId ?? undefined,
          fileName: selectedFile.name,
          contentType: mimeType,
          sizeBytes: selectedFile.size,
          title: cleanTitle,
        }),
      });
      const payload = (await res.json()) as {
        url?: string;
        key?: string;
        resourceId?: string;
        error?: string;
      };
      if (!res.ok || !payload.url) {
        setFileError(payload.error ?? "Could not start the resource upload.");
        return;
      }

      const put = await fetch(payload.url, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: selectedFile,
      });
      if (!put.ok) {
        setFileError("File upload to storage failed. Please try again.");
        return;
      }

      const newResource: AttachedCourseResource = {
        id: payload.resourceId ?? `res-${Date.now()}`,
        lessonId: lessonId ?? null,
        title: cleanTitle,
        fileName: selectedFile.name,
        contentType: mimeType,
        sizeBytes: selectedFile.size,
      };
      onFilesChange?.([...files, newResource]);
      setSelectedFile(null);
      setFileTitle("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFileSuccess(`Uploaded "${cleanTitle}"`);
      router.refresh();
    } catch {
      setFileError("Network error while uploading the resource.");
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleSaveFileTitle(resource: AttachedCourseResource) {
    const trimmed = editingFileTitle.trim();
    if (!trimmed) {
      setFileError("Enter a resource name.");
      return;
    }
    setBusyFileId(resource.id);
    setFileError(null);
    try {
      const result = await updateResource({
        resourceId: resource.id,
        courseId,
        title: trimmed,
      });
      if (!result.ok) {
        setFileError(result.error ?? "Could not update resource name.");
        return;
      }
      onFilesChange?.(
        files.map((item) =>
          item.id === resource.id ? { ...item, title: trimmed } : item
        )
      );
      setEditingFileId(null);
      router.refresh();
    } finally {
      setBusyFileId(null);
    }
  }

  async function handleDeleteFile(resourceId: string) {
    setBusyFileId(resourceId);
    setFileError(null);
    try {
      const result = await deleteResource(resourceId, courseId);
      if (!result.ok) {
        setFileError(result.error ?? "Could not remove the resource.");
        return;
      }
      onFilesChange?.(files.filter((item) => item.id !== resourceId));
      router.refresh();
    } finally {
      setBusyFileId(null);
    }
  }

  async function handleDownloadFile(resourceId: string) {
    setBusyFileId(resourceId);
    setFileError(null);
    try {
      const res = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", resourceId }),
      });
      const payload = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !payload.url) {
        setFileError(payload.error ?? "Could not generate download link.");
        return;
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } finally {
      setBusyFileId(null);
    }
  }

  function handleAddExternalLink() {
    setLinkError(null);
    const candidate = {
      id: makeLinkId(),
      title: linkTitle.trim(),
      url: linkUrl.trim(),
      description: linkDescription.trim(),
    };
    const parsed = lessonResourceLinkSchema.safeParse(candidate);
    if (!parsed.success) {
      setLinkError(
        parsed.error.issues[0]?.message ?? "Check the resource title and URL."
      );
      return;
    }
    onLinksChange?.([...links, parsed.data]);
    setLinkTitle("");
    setLinkUrl("");
    setLinkDescription("");
    setShowAddLink(false);
  }

  function handleSaveEditedLink() {
    if (!editLinkDraft) return;
    setLinkError(null);
    const parsed = lessonResourceLinkSchema.safeParse(editLinkDraft);
    if (!parsed.success) {
      setLinkError(
        parsed.error.issues[0]?.message ?? "Check the resource link details."
      );
      return;
    }
    onLinksChange?.(
      links.map((item) => (item.id === parsed.data.id ? parsed.data : item))
    );
    setEditingLinkId(null);
    setEditLinkDraft(null);
  }

  const totalCount = files.length + links.length;

  return (
    <div className="space-y-4">
      {/* Explanatory banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-800">
            <FileUp className="size-4" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-semibold text-foreground">
                Supplementary learning materials
              </span>
              <Badge variant={totalCount > 0 ? "sky" : "default"}>
                {totalCount} {totalCount === 1 ? "resource" : "resources"}
              </Badge>
            </div>
            <p className="text-[11.5px] text-muted-foreground">
              Attach downloadable files (worksheets, code archives, slides, PDFs) or external reference links that accompany this lesson.
            </p>
          </div>
        </div>
      </div>

      {fileError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
        >
          <AlertCircle
            className="mt-0.5 size-3.5 shrink-0 text-red-600"
            aria-hidden="true"
          />
          <span>{fileError}</span>
        </div>
      ) : null}

      {fileSuccess ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800"
        >
          <Check
            className="size-3.5 shrink-0 text-emerald-600"
            aria-hidden="true"
          />
          <span>{fileSuccess}</span>
        </div>
      ) : null}

      {/* Part 1: Downloadable Files (Cloudflare R2) */}
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-[13px] font-semibold text-foreground">
              Downloadable files ({files.length})
            </h4>
            <p className="text-[11.5px] text-muted-foreground">
              Supported: PDF, ZIP, DOCX, XLSX, PPTX, CSV, TXT, MD · Max{" "}
              {MAX_RESOURCE_MB} MB per file · Private R2 access
            </p>
          </div>
          {!disabled ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.zip,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                className="hidden"
                onChange={(e) => handleSelectFile(e.target.files?.[0] ?? null)}
              />
              {!selectedFile ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-1.5"
                >
                  <FileUp className="size-3.5" aria-hidden="true" />
                  Choose file to upload
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Selected file staging bar */}
        {selectedFile ? (
          <div className="mt-3 space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <div className="flex min-w-0 items-center gap-2">
                <ResourceFileIcon
                  fileName={selectedFile.name}
                  contentType={selectedFile.type}
                />
                <span className="truncate font-semibold text-foreground">
                  {selectedFile.name}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  ({formatResourceBytes(selectedFile.size)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedFile(null);
                  setFileTitle("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
              >
                Change file
              </button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-[1fr_auto] sm:items-end">
              <div className="space-y-1">
                <label className="block text-[11.5px] font-medium text-foreground">
                  Display name shown to learners{" "}
                  <span className="text-primary">*</span>
                </label>
                <Input
                  value={fileTitle}
                  maxLength={200}
                  onChange={(e) => setFileTitle(e.target.value)}
                  placeholder="e.g. Prompt Engineering Cheat Sheet (PDF)"
                  className="h-9 bg-white text-[12.5px]"
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={uploadingFile || !fileTitle.trim()}
                onClick={() => void handleUploadFile()}
              >
                {uploadingFile ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <FileUp className="size-3.5" aria-hidden="true" />
                )}
                {uploadingFile ? "Uploading…" : "Upload file"}
              </Button>
            </div>
          </div>
        ) : null}

        {/* Existing downloadable files list */}
        {files.length > 0 ? (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-zinc-50/40">
            {files.map((res) => {
              const badge = detectResourceKindBadge(
                res.fileName,
                res.contentType
              );
              const isEditing = editingFileId === res.id;
              const isBusy = busyFileId === res.id;

              return (
                <li
                  key={res.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <ResourceFileIcon
                      fileName={res.fileName}
                      contentType={res.contentType}
                    />
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={editingFileTitle}
                            maxLength={200}
                            onChange={(e) => setEditingFileTitle(e.target.value)}
                            className="h-8 bg-white text-[12.5px]"
                            aria-label="Edit resource name"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={isBusy}
                            onClick={() => void handleSaveFileTitle(res)}
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingFileId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium text-foreground">
                              {res.title}
                            </span>
                            <Badge
                              variant={badge.tone}
                              className="px-1.5 py-0 text-[10px]"
                            >
                              {badge.label}
                            </Badge>
                          </div>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {res.fileName} · {formatResourceBytes(res.sizeBytes)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {!isEditing ? (
                    <div className="flex items-center gap-1">
                      {!disabled ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isBusy}
                          onClick={() => {
                            setEditingFileId(res.id);
                            setEditingFileTitle(res.title);
                          }}
                          aria-label={`Rename ${res.title}`}
                          title="Rename resource"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isBusy}
                        onClick={() => void handleDownloadFile(res.id)}
                        aria-label={`Download ${res.title}`}
                        title="Download file"
                      >
                        <Download className="size-3.5" aria-hidden="true" />
                      </Button>
                      {!disabled ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={isBusy}
                          onClick={() => void handleDeleteFile(res.id)}
                          aria-label={`Remove ${res.title}`}
                          title="Remove file"
                          className="text-muted-foreground hover:text-red-600"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : !selectedFile ? (
          <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 px-3.5 py-3 text-[12px] text-muted-foreground">
            No downloadable files attached yet. Upload worksheets, code templates, or slide decks above.
          </div>
        ) : null}
      </div>

      {/* Part 2: External Reference Links (saved with lesson) */}
      {allowExternalLinks && onLinksChange ? (
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-[13px] font-semibold text-foreground">
                External reference links ({links.length})
              </h4>
              <p className="text-[11.5px] text-muted-foreground">
                Link to official documentation, GitHub repositories, Colab notebooks, or live sandboxes.
              </p>
            </div>
            {!showAddLink && !disabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setLinkError(null);
                  setShowAddLink(true);
                }}
                className="gap-1.5"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Add external link
              </Button>
            ) : null}
          </div>

          {linkError ? (
            <div
              role="alert"
              className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700"
            >
              <AlertCircle
                className="size-3.5 shrink-0 text-red-600"
                aria-hidden="true"
              />
              <span>{linkError}</span>
            </div>
          ) : null}

          {showAddLink ? (
            <div className="mt-3 space-y-3 rounded-lg border border-border bg-zinc-50/60 p-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-[11.5px] font-medium text-foreground">
                    Resource name <span className="text-primary">*</span>
                  </label>
                  <Input
                    value={linkTitle}
                    maxLength={160}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="e.g. Starter Repository on GitHub"
                    className="h-9 bg-white text-[12.5px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11.5px] font-medium text-foreground">
                    URL (https://) <span className="text-primary">*</span>
                  </label>
                  <Input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://github.com/example/starter-kit"
                    className="h-9 bg-white text-[12.5px]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[11.5px] font-medium text-foreground">
                  Short description{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <Input
                  value={linkDescription}
                  maxLength={400}
                  onChange={(e) => setLinkDescription(e.target.value)}
                  placeholder="Clone this branch before starting the hands-on exercise"
                  className="h-9 bg-white text-[12.5px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddLink(false);
                    setLinkError(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddExternalLink}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add link to lesson
                </Button>
              </div>
            </div>
          ) : null}

          {links.length > 0 ? (
            <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-zinc-50/40">
              {links.map((item) => {
                const isEditing = editingLinkId === item.id && editLinkDraft;
                return (
                  <li key={item.id} className="px-3 py-2.5">
                    {isEditing && editLinkDraft ? (
                      <div className="space-y-2.5">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            value={editLinkDraft.title}
                            maxLength={160}
                            onChange={(e) =>
                              setEditLinkDraft({
                                ...editLinkDraft,
                                title: e.target.value,
                              })
                            }
                            placeholder="Resource title"
                            className="h-8 bg-white text-[12.5px]"
                          />
                          <Input
                            type="url"
                            value={editLinkDraft.url}
                            onChange={(e) =>
                              setEditLinkDraft({
                                ...editLinkDraft,
                                url: e.target.value,
                              })
                            }
                            placeholder="https://..."
                            className="h-8 bg-white text-[12.5px]"
                          />
                        </div>
                        <Input
                          value={editLinkDraft.description ?? ""}
                          maxLength={400}
                          onChange={(e) =>
                            setEditLinkDraft({
                              ...editLinkDraft,
                              description: e.target.value,
                            })
                          }
                          placeholder="Optional description"
                          className="h-8 bg-white text-[12.5px]"
                        />
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingLinkId(null);
                              setEditLinkDraft(null);
                            }}
                          >
                            <X className="size-3.5" aria-hidden="true" />
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleSaveEditedLink}
                          >
                            <Check className="size-3.5" aria-hidden="true" />
                            Apply
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2.5">
                          <Link2
                            className="mt-0.5 size-4 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-[13px] font-medium text-foreground">
                                {item.title}
                              </span>
                              <Badge
                                variant="violet"
                                className="px-1.5 py-0 text-[10px]"
                              >
                                LINK
                              </Badge>
                            </div>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex max-w-full items-center gap-1 truncate text-[11.5px] text-primary hover:underline"
                            >
                              <span className="truncate">{item.url}</span>
                              <ExternalLink
                                className="size-3 shrink-0"
                                aria-hidden="true"
                              />
                            </a>
                            {item.description ? (
                              <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                                {item.description}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {!disabled ? (
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                setEditingLinkId(item.id);
                                setEditLinkDraft({ ...item });
                              }}
                              aria-label={`Edit ${item.title}`}
                              title="Edit link"
                            >
                              <Pencil className="size-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                onLinksChange(
                                  links.filter(
                                    (candidate) => candidate.id !== item.id
                                  )
                                )
                              }
                              aria-label={`Remove ${item.title}`}
                              title="Remove link"
                              className="text-muted-foreground hover:text-red-600"
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : !showAddLink ? (
            <div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 px-3.5 py-3 text-[12px] text-muted-foreground">
              No external reference links added yet. Remember to click{" "}
              <strong className="font-medium text-foreground">Save lesson</strong> after adding or editing links.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

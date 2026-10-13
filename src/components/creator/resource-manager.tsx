"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
import * as React from "react";
import { useRef, useState } from "react";
import { CloudUpload, File, FileText, FileVideo, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { CreatorResource, UploadedMedia } from "@/types";
import { uid } from "@/lib/creator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const KIND_ICON = { video: FileVideo, pdf: FileText, zip: Package, doc: FileText, file: File } as const;

/**
 * Frontend-only media manager. Selected files are listed with their real
 * name/size (local preview only) — nothing is uploaded or processed.
 */
export function UploadSlot({
  title = "Upload video",
  accept = "video/*",
  uploads,
  onChange,
}: {
  title?: string;
  accept?: string;
  uploads: UploadedMedia[];
  onChange: (uploads: UploadedMedia[]) => void;
}) {
  const translateUi = useTranslate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next: UploadedMedia[] = Array.from(files).map((f) => ({
      fileName: f.name,
      fileSize: f.size,
      kind: f.type.startsWith("video") ? "video" : "resource",
    }));
    onChange([...uploads, ...next]);
    toast.success(`${next.length} file${next.length > 1 ? "s" : ""} added (local preview only)`);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors",
          dragOver ? "border-primary bg-accent" : "border-zinc-300 bg-muted/40 hover:border-zinc-400 hover:bg-muted"
        )}
      >
        <span className="flex size-10 items-center justify-center rounded-xl bg-white text-primary shadow-card">
          <CloudUpload className="size-5" aria-hidden />
        </span>
        <span className="text-[13.5px] font-medium"><LocalizedText text={title} /></span>
        <span className="max-w-xs text-[12px] leading-relaxed text-zinc-400"><LocalizedText text={"Drop files or click to browse. Files stay on this device — uploading and media processing are not connected in this preview."} /></span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-2">
          {uploads.map((u, i) => (
            <li
              key={`${u.fileName}-${i}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2.5"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                {u.kind === "video" ? <FileVideo className="size-4" aria-hidden /> : <File className="size-4" aria-hidden />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium"><LocalizedText text={u.fileName} /></p>
                <p className="text-[11.5px] text-zinc-400">
                  <LocalizedText text={formatSize(u.fileSize)} /><LocalizedText text={"· Local preview — not uploaded"} /></p>
              </div>
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700"><LocalizedText text={"Ready"} /></span>
              <button
                type="button"
                aria-label={translateUi(`Remove ${u.fileName}`)}
                onClick={() => onChange(uploads.filter((_, idx) => idx !== i))}
                className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Downloadable resource entries (metadata only). */
export function ResourceManager({
  resources,
  onChange,
}: {
  resources: CreatorResource[];
  onChange: (resources: CreatorResource[]) => void;
}) {
  const translateUi = useTranslate();
  const [title, setTitle] = useState("");
  const [fileType, setFileType] = useState<CreatorResource["fileType"]>("pdf");
  const [sizeMb, setSizeMb] = useState(1);

  const add = () => {
    const t = title.trim();
    if (!t) return;
    onChange([...resources, { id: uid("res"), title: t, fileType, sizeMb: Math.max(0.1, sizeMb) }]);
    setTitle("");
  };

  return (
    <div>
      {resources.length === 0 ? (
        <EmptyState
          icon={Package}
          title={translateUi("No downloadable resources yet")}
          description={translateUi("Templates, checklists and cheat-sheets make your course much more valuable.")}
        />
      ) : (
        <ul className="space-y-2">
          {resources.map((r) => {
            const Icon = KIND_ICON[r.fileType];
            return (
              <li key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-white px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-zinc-500">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium"><LocalizedText text={r.title} /></p>
                  <p className="text-[11.5px] text-zinc-400 uppercase">
                    {r.fileType} · {r.sizeMb}<LocalizedText text={"MB"} /></p>
                </div>
                <button
                  type="button"
                  aria-label={translateUi(`Remove ${r.title}`)}
                  onClick={() => onChange(resources.filter((x) => x.id !== r.id))}
                  className="cursor-pointer rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3 sm:flex-row">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={translateUi("Resource title, e.g. Prompt library (PDF)")}
          aria-label={translateUi("Resource title")}
          className="flex-1 bg-white"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <div className="flex gap-2">
          <select
            aria-label={translateUi("Resource type")}
            value={fileType}
            onChange={(e) => setFileType(e.target.value as CreatorResource["fileType"])}
            className="h-9.5 cursor-pointer rounded-lg border border-input bg-white px-2.5 text-sm shadow-xs outline-none focus-visible:border-primary/50"
          >
            <option value="pdf"><LocalizedText text={"PDF"} /></option>
            <option value="doc"><LocalizedText text={"Doc"} /></option>
            <option value="zip"><LocalizedText text={"ZIP"} /></option>
            <option value="file"><LocalizedText text={"Other"} /></option>
          </select>
          <Input
            type="number"
            min={0.1}
            step={0.1}
            value={sizeMb}
            onChange={(e) => setSizeMb(Number(e.target.value))}
            aria-label={translateUi("Size in MB")}
            className="w-20 bg-white"
          />
          <Button type="button" variant="outline" onClick={add} disabled={!title.trim()}>
            <Plus aria-hidden /><LocalizedText text={"Add"} /></Button>
        </div>
      </div>
    </div>
  );
}

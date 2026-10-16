"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { FileUp, HelpCircle, Loader2, Plus, Video } from "lucide-react";
import { saveLesson } from "@/app/creator/actions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Mode = "choose" | "video" | "quiz" | "resource";

export function AddLessonDialog({ courseId, sectionId, sortOrder, disabled }: { courseId: string; sectionId: string; sortOrder: number; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("choose");
  const [title, setTitle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  function reset() { setMode("choose"); setTitle(""); setNotes(""); setFile(null); setError(null); setStatus(null); }
  function close(v: boolean) { setOpen(v); if (!v) reset(); }

  async function createVideo() {
    if (!title.trim() || !file) { setError(!title.trim() ? "Add a lesson title." : "Choose a video file."); return; }
    setBusy(true); setError(null);
    try {
      const created = await saveLesson({ courseId, sectionId, title, kind: "video", sortOrder, durationMinutes: 0, isPreview: false });
      if (!created.ok || !created.id) throw new Error(created.error ?? "Could not add the lesson.");
      setStatus("Uploading video…");
      const grantRes = await fetch("/api/media/video/grant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lessonId: created.id, fileName: file.name, contentType: file.type, sizeBytes: file.size }) });
      if (!grantRes.ok) { const b = (await grantRes.json().catch(() => ({}))) as { error?: string }; throw new Error(b.error ?? "Could not start the upload. The lesson was saved — upload from its row."); }
      const grant = (await grantRes.json()) as { tusEndpoint: string; headers: Record<string, string> };
      await tusUpload(grant, file);
      setStatus("Uploaded — processing will finish shortly.");
      router.refresh(); close(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); } finally { setBusy(false); }
  }

  async function createQuiz() {
    if (!title.trim()) { setError("Add a quiz title."); return; }
    setBusy(true); setError(null);
    const r = await saveLesson({ courseId, sectionId, title, description: notes, kind: "quiz", sortOrder, durationMinutes: 0, isPreview: false }).catch(() => ({ ok: false, error: "Something went wrong." }));
    setBusy(false);
    if (!r.ok) { setError(r.error ?? "Could not add the quiz."); return; }
    router.refresh(); close(false);
  }

  async function uploadResource() {
    if (!file) { setError("Choose a file to upload."); return; }
    setBusy(true); setError(null); setStatus("Uploading resource…");
    try {
      const res = await fetch("/api/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "upload", kind: "resource", courseId, fileName: file.name, contentType: file.type || "application/octet-stream", sizeBytes: file.size, title: title || file.name }) });
      if (!res.ok) { const b = (await res.json().catch(() => ({}))) as { error?: string }; throw new Error(b.error ?? "Could not start the upload."); }
      const grant = (await res.json()) as { url: string };
      const put = await fetch(grant.url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: file });
      if (!put.ok) throw new Error("The upload could not be stored. Try again.");
      router.refresh(); close(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); } finally { setBusy(false); setStatus(null); }
  }

  const options = [
    { id: "video" as Mode, label: "Video", desc: "Upload a video lesson", icon: Video },
    { id: "quiz" as Mode, label: "Quiz", desc: "Add a knowledge check", icon: HelpCircle },
    { id: "resource" as Mode, label: "Resources", desc: "Upload a downloadable file", icon: FileUp },
  ];

  return (
    <>
      <div className="border-t border-border px-4 py-3">
        <Button type="button" size="sm" disabled={disabled} onClick={() => setOpen(true)}><Plus className="size-4" aria-hidden /> Add a lesson</Button>
      </div>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "choose" ? "Add a lesson" : mode === "video" ? "Video lesson" : mode === "quiz" ? "Quiz" : "Resources"}</DialogTitle>
            <DialogDescription>{mode === "choose" ? "Choose what to add to this section." : mode === "video" ? "Add a title and upload the video." : mode === "quiz" ? "Set up the quiz for this section." : "Upload a file learners can download."}</DialogDescription>
          </DialogHeader>
          {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">{error}</p> : null}
          {status ? <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">{busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}{status}</p> : null}

          {mode === "choose" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {options.map((o) => (
                <button key={o.id} type="button" onClick={() => setMode(o.id)} className="group rounded-2xl border border-border bg-white p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:outline-none">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary"><o.icon className="size-5" aria-hidden /></span>
                  <span className="mt-3 block text-[14px] font-semibold">{o.label}</span>
                  <span className="mt-0.5 block text-[12px] text-muted-foreground">{o.desc}</span>
                </button>
              ))}
            </div>
          ) : mode === "video" ? (
            <div className="space-y-3">
              <div><Label htmlFor="al-video-title" className="mb-1.5 block text-[13px]">Lesson title</Label><Input id="al-video-title" value={title} maxLength={160} placeholder="e.g. Welcome & setup" onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label htmlFor="al-video-file" className="mb-1.5 block text-[13px]">Video file</Label><Input id="al-video-file" type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              <div className="flex gap-2 pt-1"><Button type="button" disabled={busy} loading={busy} onClick={() => void createVideo()}>Upload video</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setMode("choose")}>Back</Button></div>
            </div>
          ) : mode === "quiz" ? (
            <div className="space-y-3">
              <div><Label htmlFor="al-quiz-title" className="mb-1.5 block text-[13px]">Quiz title</Label><Input id="al-quiz-title" value={title} maxLength={160} placeholder="e.g. Check your understanding" onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label htmlFor="al-quiz-notes" className="mb-1.5 block text-[13px]">Instructions</Label><Textarea id="al-quiz-notes" rows={3} maxLength={2000} value={notes} placeholder="What should learners know before starting?" onChange={(e) => setNotes(e.target.value)} /></div>
              <div className="flex gap-2 pt-1"><Button type="button" disabled={busy} loading={busy} onClick={() => void createQuiz()}>Save quiz</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setMode("choose")}>Back</Button></div>
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label htmlFor="al-res-title" className="mb-1.5 block text-[13px]">Resource title <span className="font-normal text-zinc-400">(optional)</span></Label><Input id="al-res-title" value={title} maxLength={200} placeholder="e.g. Starter files" onChange={(e) => setTitle(e.target.value)} /></div>
              <div><Label htmlFor="al-res-file" className="mb-1.5 block text-[13px]">File</Label><Input id="al-res-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
              <div className="flex gap-2 pt-1"><Button type="button" disabled={busy} loading={busy} onClick={() => void uploadResource()}>Upload resource</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => setMode("choose")}>Back</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

async function tusUpload(grant: { tusEndpoint: string; headers: Record<string, string> }, file: File): Promise<void> {
  const metadata = encodeURIComponent(Object.entries({ filename: file.name, filetype: file.type }).map(([k, v]) => `${k} ${btoa(v)}`).join(","));
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", grant.tusEndpoint, true);
    xhr.setRequestHeader("Tus-Resumable", "1.0.0");
    xhr.setRequestHeader("Upload-Length", String(file.size));
    xhr.setRequestHeader("Upload-Metadata", metadata);
    for (const [h, v] of Object.entries(grant.headers)) xhr.setRequestHeader(h, v);
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload rejected (${xhr.status})`)));
    xhr.send(file);
  });
}

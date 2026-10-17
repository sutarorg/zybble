"use client";

import * as React from "react";
import {
  ResourcesLessonPanel,
  type AttachedCourseResource,
} from "../curriculum/resources-lesson-panel";

export interface ResourceItem {
  id: string;
  lessonId?: string | null;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

interface ResourceManagerProps {
  courseId: string;
  editable?: boolean;
  items: ResourceItem[];
}

export function ResourceManager({
  courseId,
  editable = true,
  items,
}: ResourceManagerProps) {
  const [files, setFiles] = React.useState<AttachedCourseResource[]>(() =>
    items.map((item) => ({
      id: item.id,
      lessonId: item.lessonId ?? null,
      title: item.title,
      fileName: item.fileName,
      contentType: item.contentType,
      sizeBytes: item.sizeBytes,
    }))
  );

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-white p-5 shadow-card sm:p-6">
      <div>
        <h2 className="font-display text-[17px] font-semibold text-foreground">
          Downloadable course resources
        </h2>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Attach course-wide worksheets, code bundles, or reference PDFs. These are stored in private Cloudflare R2 storage and unlocked for enrolled learners.
        </p>
      </div>

      <ResourcesLessonPanel
        courseId={courseId}
        lessonId={null}
        files={files}
        onFilesChange={setFiles}
        allowExternalLinks={false}
        disabled={!editable}
      />
    </div>
  );
}

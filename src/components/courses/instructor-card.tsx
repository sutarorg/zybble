"use client";

import * as React from "react";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Award, BookOpen, Star, Users } from "lucide-react";
import type { Instructor } from "@/types";
import { instructorStats } from "@/lib/courses";
import { formatCompact } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function InstructorCard({ instructor }: { instructor: Instructor }) {
  const [expanded, setExpanded] = useState(false);
  const stats = instructorStats(instructor.id);

  return (
    <div className="rounded-xl border border-border bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <Link href={`/instructors/${instructor.username}`} className="shrink-0">
          <Avatar className="size-16 ring-1 ring-border">
            <AvatarFallback className={cn("text-lg font-bold", instructor.avatarColor)}>
              {instructor.initials}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/instructors/${instructor.username}`}
            className="font-display text-[15.5px] font-semibold tracking-tight transition-colors hover:text-primary"
          >
            {instructor.name}
          </Link>
          <p className="text-[13px] text-muted-foreground">{instructor.headline}</p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Star className="size-3.5 fill-star text-star" aria-hidden />
              <span className="font-semibold text-foreground">{stats.rating}</span> instructor rating
            </span>
            <span className="flex items-center gap-1.5">
              <Award className="size-3.5 text-zinc-400" aria-hidden />
              {formatCompact(stats.reviews)} reviews
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-zinc-400" aria-hidden />
              {formatCompact(stats.students)} students
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-3.5 text-zinc-400" aria-hidden />
              {stats.courses} {stats.courses === 1 ? "course" : "courses"}
            </span>
          </div>

          <p className={cn("mt-3 text-[13.5px] leading-relaxed text-muted-foreground", !expanded && "line-clamp-2")}>
            {instructor.bio}
          </p>
          <div className="mt-2 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="cursor-pointer text-[13px] font-medium text-primary hover:text-primary-hover"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
            <Link
              href={`/instructors/${instructor.username}`}
              className="group flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-hover"
            >
              View profile
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Bookmark, Compass } from "lucide-react";
import { COURSES } from "@/data/mock-data";
import { useApp } from "@/components/providers/app-providers";
import { useCommunityCourses } from "@/components/providers/creator-provider";
import { CourseCard } from "@/components/courses/course-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function WishlistClient() {
  const { wishlist, hydrated } = useApp();
  const community = useCommunityCourses();
  const pool = [...community, ...COURSES];
  const courses = pool.filter((c) => wishlist.includes(c.id));

  return (
    <div className="page-container py-7 sm:py-9">
      <header>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase">Saved</p>
        <h1 className="font-display mt-2 text-[26px] font-bold tracking-tight sm:text-[34px]">
          Your wishlist
        </h1>
        <p className="mt-2 text-[14.5px] text-muted-foreground">
          {hydrated
            ? courses.length > 0
              ? `${courses.length} ${courses.length === 1 ? "course" : "courses"} saved for later. Shared with the public storefront.`
              : "Courses you bookmark will live here — saved on this device."
            : "Loading your saved courses…"}
        </p>
      </header>

      <div className="mt-8">
        {!hydrated ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title="Your wishlist is empty"
            description="Found something interesting? Tap the bookmark on any course card and it'll be waiting for you here."
            action={
              <Button asChild>
                <Link href="/explore">
                  <Compass aria-hidden />
                  Explore courses
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

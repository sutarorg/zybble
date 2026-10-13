"use client";

import { LocalizedText, useTranslate } from "@/components/providers/localized-text";
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
  const translateUi = useTranslate();
  const { wishlist, hydrated } = useApp();
  const community = useCommunityCourses();
  const pool = [...community, ...COURSES];
  const courses = pool.filter((c) => wishlist.includes(c.id));

  return (
    <div className="page-container py-7 sm:py-9">
      <header>
        <p className="text-[11px] font-bold tracking-[0.14em] text-primary uppercase"><LocalizedText text={"Saved"} /></p>
        <h1 className="font-display mt-2 text-[26px] font-bold tracking-tight sm:text-[34px]"><LocalizedText text={"Your wishlist"} /></h1>
        <p className="mt-2 text-[14.5px] text-muted-foreground">
          {<LocalizedText text={hydrated
            ? courses.length > 0
              ? `${courses.length} ${courses.length === 1 ? "course" : "courses"} saved for later. Shared with the public storefront.`
              : "Courses you bookmark will live here — saved on this device."
            : "Loading your saved courses…"} />}
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
            title={translateUi("Your wishlist is empty")}
            description={translateUi("Found something interesting? Tap the bookmark on any course card and it'll be waiting for you here.")}
            action={
              <Button asChild>
                <Link href="/">
                  <Compass aria-hidden /><LocalizedText text={"Explore courses"} /></Link>
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

"use client";

import * as React from "react";
import { useState, useRef, useCallback } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, formatFileSize } from "@/lib/utils";
import { MAX_FILE_SIZE } from "@/lib/upload";

interface ProfilePictureUploadProps {
  currentAvatar?: string;
  initials: string;
  name: string;
  onUpload: (file: File) => Promise<{ success: boolean; error?: string; avatarUrl?: string }>;
  className?: string;
  avatarClassName?: string;
}

export function ProfilePictureUpload({
  currentAvatar,
  initials,
  name,
  onUpload,
  className,
  avatarClassName,
}: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatar || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(file.type)) {
        setError("Only JPEG, PNG, WebP, and GIF images are allowed");
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File size exceeds maximum limit of ${formatFileSize(MAX_FILE_SIZE)}`);
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        const result = await onUpload(file);
        if (result.success && result.avatarUrl) {
          setPreviewUrl(result.avatarUrl);
          toast.success("Profile picture updated!");
        } else {
          setError(result.error || "Failed to upload image");
          toast.error(result.error || "Failed to upload image");
        }
      } catch {
        setError("Failed to upload image. Please try again.");
        toast.error("Failed to upload image. Please try again.");
      } finally {
        setIsUploading(false);
        // Reset input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [onUpload]
  );

  const handleRemove = useCallback(() => {
    setPreviewUrl(null);
    setError(null);
    // In a real app, you would call an API to remove the avatar
    toast.success("Profile picture removed");
  }, []);

  const triggerFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative">
        <Avatar className={cn("size-24", avatarClassName)}>
          {previewUrl && <AvatarImage src={previewUrl} alt={name} />}
          <AvatarFallback className="bg-primary text-xl text-white">{initials}</AvatarFallback>
        </Avatar>
        
        {/* Upload overlay */}
        <button
          type="button"
          onClick={triggerFileInput}
          disabled={isUploading}
          className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/30 transition-colors hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Change profile picture"
        >
          {isUploading ? (
            <Loader2 className="size-5 animate-spin text-white" />
          ) : (
            <Camera className="size-5 text-white" />
          )}
        </button>

        {/* Remove button */}
        {previewUrl && !isUploading && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemove();
            }}
            className="absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow-md transition-colors hover:bg-destructive/90"
            aria-label="Remove profile picture"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
        disabled={isUploading}
      />

      <div className="text-center">
        <p className="text-[13px] font-medium">{name}</p>
        <p className="text-[11.5px] text-muted-foreground">Click to upload</p>
        {error && <p className="mt-1 text-[12px] text-red-500">{error}</p>}
        <p className="text-[10px] text-zinc-400">Max {formatFileSize(MAX_FILE_SIZE)}</p>
      </div>
    </div>
  );
}

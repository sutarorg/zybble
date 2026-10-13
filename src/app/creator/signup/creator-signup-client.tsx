"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, User, Mail, Lock, Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { useApp } from "@/components/providers/app-providers";
import { useCreator } from "@/components/providers/creator-provider";
import { cn } from "@/lib/utils";

export function CreatorSignupClient() {
  const router = useRouter();
  const { user, signIn } = useApp();
  const { profile, saveProfile } = useCreator();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // If already logged in as learner, convert to creator
  React.useEffect(() => {
    if (user) {
      // Check if user already has creator role
      if (user.role === "creator") {
        router.push("/creator");
      }
    }
  }, [user, router]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!formData.password) newErrors.password = "Password is required";
    else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters";
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);

    try {
      // Simulate creator account creation
      const newUser = {
        id: crypto.randomUUID(),
        name: formData.name,
        email: formData.email,
        initials: formData.name
          .split(" ")
          .map((n) => n.charAt(0).toUpperCase())
          .slice(0, 2)
          .join(""),
        avatar: undefined,
        role: "creator" as const,
      };

      // Sign in the new creator
      signIn(newUser);

      // Save creator profile
      saveProfile({
        displayName: formData.name,
        headline: "Instructor",
        bio: "",
        initials: newUser.initials,
        avatarColor: "bg-violet-500",
        country: "",
        languages: ["English"],
      });

      toast.success("Creator account created! Welcome to Zybble Studio.");
      router.push("/creator");
    } catch (error) {
      toast.error("Failed to create account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-dvh bg-muted/40">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur sm:gap-3 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="-ml-1 shrink-0">
          <Link href="/" aria-label="Back to home">
            <ArrowLeft aria-hidden />
          </Link>
        </Button>
        <Logo href="/" />
      </header>

      <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-md">
          <div className="text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight">Become a Creator</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              Join Zybble as an instructor and start sharing your knowledge with the world.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[13px] font-semibold">
                Full Name
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" aria-hidden />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={cn("pl-10", errors.name && "border-red-500")}
                  disabled={isLoading}
                />
              </div>
              {errors.name && <p className="text-[12px] text-red-500">{errors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-semibold">
                Email Address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" aria-hidden />
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={cn("pl-10", errors.email && "border-red-500")}
                  disabled={isLoading}
                />
              </div>
              {errors.email && <p className="text-[12px] text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-semibold">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" aria-hidden />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChange={(e) => handleChange("password", e.target.value)}
                  className={cn("pl-10 pr-10", errors.password && "border-red-500")}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password && <p className="text-[12px] text-red-500">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[13px] font-semibold">
                Confirm Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-400" aria-hidden />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange("confirmPassword", e.target.value)}
                  className={cn("pl-10 pr-10", errors.confirmPassword && "border-red-500")}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-[12px] text-red-500">{errors.confirmPassword}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full gap-2"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <Check className="size-4" />
                  Create Creator Account
                </>
              )}
            </Button>

            <p className="text-center text-[13px] text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>

          <div className="mt-8 rounded-xl border border-border bg-white p-6">
            <h2 className="text-[14px] font-semibold">Why teach on Zybble?</h2>
            <ul className="mt-4 space-y-3">
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-3" />
                </span>
                <span className="text-[13.5px] text-muted-foreground">Reach thousands of eager learners</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-3" />
                </span>
                <span className="text-[13.5px] text-muted-foreground">Flexible course creation tools</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Check className="size-3" />
                </span>
                <span className="text-[13.5px] text-muted-foreground">Earn money from your expertise</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

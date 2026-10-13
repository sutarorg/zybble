"use client";
import { useApp } from "./app-providers";
import { translateText } from "@/lib/i18n/text";

/** Render translations through React (no DOM mutation or external services). */
export function LocalizedText({ text }: { text: React.ReactNode }) {
  const { language } = useApp();
  return <>{typeof text === "string" ? ` ${translateText(text, language).trim()} ` : text}</>;
}
export function useTranslate() {
  const { language } = useApp();
  return (text: string) => translateText(text, language);
}

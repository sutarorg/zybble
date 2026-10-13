import type { Metadata } from "next";
import { CertificatesClient } from "./certificates-client";

export const metadata: Metadata = {
  title: "Certificates",
  description:
    "Every Zybble course you complete earns a personalised certificate you can preview and download.",
};

export default function CertificatesPage() {
  return <CertificatesClient />;
}

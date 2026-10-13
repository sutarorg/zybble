import type { Metadata } from "next";
import { HomeClient } from "./home-client";

export const metadata: Metadata = {
  title: "Zybble — Learn AI Skills That Matter",
  description:
    "Zybble is the global marketplace for practical AI courses: automation, development, generative AI, creation, marketing, data science, business and productivity. Finish a course and earn a certificate.",
};

export default function HomePage() {
  return <HomeClient />;
}

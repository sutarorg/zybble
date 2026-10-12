import type { Metadata } from "next";
import { MyLearningClient } from "./my-learning-client";

export const metadata: Metadata = {
  title: "My Learning",
  description: "Courses you're enrolled in, with your progress.",
};

export default function MyLearningPage() {
  return <MyLearningClient />;
}

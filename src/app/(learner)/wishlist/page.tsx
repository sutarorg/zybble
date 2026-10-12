import type { Metadata } from "next";
import { WishlistClient } from "./wishlist-client";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Courses you saved for later.",
};

export default function WishlistPage() {
  return <WishlistClient />;
}

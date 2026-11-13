import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { CONTENT_PAGES } from "@/lib/content-pages";
import "../content.css";

export const metadata: Metadata = {
  title: "Shipping · AB Tech",
  description: "Delivery options, dispatch times, tracking and shipping restrictions at AB Tech."
};

export default function ShippingPage() {
  return <ContentPage page={CONTENT_PAGES.shipping} />;
}

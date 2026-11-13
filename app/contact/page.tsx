import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { CONTENT_PAGES } from "@/lib/content-pages";
import "../content.css";

export const metadata: Metadata = {
  title: "Contact · AB Tech",
  description: "Contact AB Tech for product questions, order support and wholesale enquiries."
};

export default function ContactPage() {
  return <ContentPage page={CONTENT_PAGES.contact} />;
}

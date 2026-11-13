import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { CONTENT_PAGES } from "@/lib/content-pages";
import "../content.css";

export const metadata: Metadata = {
  title: "Returns · AB Tech",
  description: "How returns, faulty items and refunds are handled at AB Tech."
};

export default function ReturnsPage() {
  return <ContentPage page={CONTENT_PAGES.returns} />;
}

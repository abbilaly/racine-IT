import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { CONTENT_PAGES } from "@/lib/content-pages";
import "../content.css";

export const metadata: Metadata = {
  title: "Terms of sale · AB Tech",
  description: "Terms that apply to purchases made through the AB Tech store."
};

export default function TermsPage() {
  return <ContentPage page={CONTENT_PAGES.terms} />;
}

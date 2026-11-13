import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { CONTENT_PAGES } from "@/lib/content-pages";
import "../content.css";

export const metadata: Metadata = {
  title: "Privacy · AB Tech",
  description: "What personal data AB Tech processes, why, and the choices you have."
};

export default function PrivacyPage() {
  return <ContentPage page={CONTENT_PAGES.privacy} />;
}

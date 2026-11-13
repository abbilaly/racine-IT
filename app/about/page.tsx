import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { CONTENT_PAGES } from "@/lib/content-pages";
import "../content.css";

export const metadata: Metadata = {
  title: "About · AB Tech",
  description:
    "AB Tech is an online electronics store for phones, laptops, tablets, audio, wearables and accessories."
};

export default function AboutPage() {
  return <ContentPage page={CONTENT_PAGES.about} />;
}

import type { Metadata } from "next";
import ContentPage from "@/components/ContentPage";
import { CONTENT_PAGES } from "@/lib/content-pages";
import "../content.css";

export const metadata: Metadata = {
  title: "FAQ · AB Tech",
  description: "Answers about pricing, stock, wholesale quotes, accounts, tracking, warranty and returns."
};

export default function FaqPage() {
  return <ContentPage page={CONTENT_PAGES.faq} />;
}

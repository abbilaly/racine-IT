import Link from "next/link";
import CompareTable from "@/components/CompareTable";
import { requireCatalog } from "@/lib/server/catalog";

export const metadata = {
  title: "Compare — AB Tech",
  description: "Compare up to four products side by side."
};

export default async function ComparePage() {
  // Catalogue-backed page: fail visibly rather than comparing seed specs.
  await requireCatalog();

  return (
    <main className="site-shell page">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link> <span>/</span> <span aria-current="page">Compare</span>
      </nav>
      <div className="page-heading">
        <h1>Compare Products</h1>
        <p>Side-by-side specs for the products you selected.</p>
      </div>
      <CompareTable />
    </main>
  );
}

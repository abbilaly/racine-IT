import { adminClient, requireAdmin } from "@/lib/server/admin-auth";
import { listBanners } from "@/lib/server/banners";
import { BannersManager } from "@/components/admin/BannersManager";
import { TablePageHeader } from "@/components/admin/tables/page-header";

export const dynamic = "force-dynamic";

export default async function AdminBannersPage() {
  const session = await requireAdmin();
  const db = adminClient(session);

  let available = true;
  let responsive = true;
  let rows: Awaited<ReturnType<typeof listBanners>>["rows"] = [];
  try {
    const result = await listBanners(db);
    available = result.available;
    responsive = result.responsive;
    rows = result.rows;
  } catch {
    available = false;
  }

  const active = rows.filter(row => row.is_active).length;

  return (
    <div className="admin-page">
      <TablePageHeader
        title="Homepage banners"
        subtitle={
          available
            ? `${active} visible of ${rows.length} · hero slides shown on the storefront homepage`
            : "Hero banners that appear on the storefront homepage"
        }
      />

      <BannersManager initial={rows} available={available} responsive={responsive} />
    </div>
  );
}

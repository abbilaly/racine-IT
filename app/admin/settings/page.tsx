import SettingsForm, { type AdminSettings } from "@/components/admin/SettingsForm";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";
import { TablePageHeader } from "@/components/admin/tables/page-header";
import { TableCard } from "@/components/admin/tables/table";

export const dynamic = "force-dynamic";

type SettingsRow = {
  store_name: string;
  currency: string | null;
  standard_shipping_cents: number;
  express_shipping_cents: number;
  checkout_enabled: boolean;
};

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  const db = adminClient(session);
  const { data, error } = await db.from("store_settings").select("*").eq("id", true).maybeSingle();

  if (error || !data) {
    return (
      <div className="admin-page">
        <TablePageHeader
          title="Store settings"
          subtitle="Currency, shipping fees and checkout availability, read by the storefront and by checkout"
        />
        <TableCard className="p-6">
          <h2 className="m-0 text-[14px] font-semibold text-foreground">Store settings are unavailable</h2>
          <p className="m-0 mt-1 text-[13px] text-muted-foreground">
            {error?.message ?? "The settings row is missing from the database."}
          </p>
        </TableCard>
      </div>
    );
  }

  const row = data as SettingsRow;
  const initial: AdminSettings = {
    storeName: row.store_name,
    currency: row.currency ?? "USD",
    standardShipping: row.standard_shipping_cents / 100,
    expressShipping: row.express_shipping_cents / 100,
    checkoutEnabled: row.checkout_enabled
  };

  return (
    <div className="admin-page">
      <TablePageHeader
        title="Store settings"
        subtitle="Currency, shipping fees and checkout availability, read by the storefront and by checkout"
      />
      <SettingsForm initial={initial} />
    </div>
  );
}

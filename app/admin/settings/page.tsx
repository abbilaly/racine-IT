import SettingsForm, { type AdminSettings } from "@/components/admin/SettingsForm";
import { adminClient, requireAdmin } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

type SettingsRow = {
  store_name: string;
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
        <div className="empty-state">
          <h2>Store settings are unavailable</h2>
          <p>{error?.message ?? "The settings row is missing from the database."}</p>
        </div>
      </div>
    );
  }

  const row = data as SettingsRow;
  const initial: AdminSettings = {
    storeName: row.store_name,
    standardShipping: row.standard_shipping_cents / 100,
    expressShipping: row.express_shipping_cents / 100,
    checkoutEnabled: row.checkout_enabled
  };

  return (
    <div className="admin-page">
      <div className="page-heading">
        <div>
          <h1>Store settings</h1>
          <p>Shipping fees and checkout availability, read by the storefront and by checkout</p>
        </div>
      </div>
      <SettingsForm initial={initial} />
    </div>
  );
}

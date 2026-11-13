import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/server/customer-auth";
import OrderDetailClient from "../../../account/orders/OrderClient";

export const metadata = {
  title: "Order — AB Tech",
  description: "View an AB Tech order detail.",
};

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/account/signin");
  }

  const { id } = await params;
  return <OrderDetailClient orderId={id} />;
}

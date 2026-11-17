import type { ReactNode } from "react";

/**
 * Signs out by POSTing to the existing `/api/admin/logout` route, which clears
 * the httpOnly session cookie and 303-redirects to /admin/login. A native form
 * keeps the flow working without JavaScript; the previous link pointed at the
 * login page and never cleared the session.
 */
export function LogoutForm({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <form action="/api/admin/logout" method="post" className={className}>
      {children}
    </form>
  );
}

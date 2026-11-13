import type { EmailLogRow } from "@/lib/server/email-center";

export function EmailHistoryTable({ rows }: { rows: EmailLogRow[] }) {
  return (
    <div>
      {rows.map((row: EmailLogRow) => (
        <div key={row.id}>
          <div>{row.subject}</div>
          <div>{row.to_email}</div>
        </div>
      ))}
    </div>
  );
}

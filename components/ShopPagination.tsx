import Link from "next/link";
import { shopHref, type ShopState } from "@/lib/shop-params";

type Props = {
  state: ShopState;
  page: number;
  pages: number;
};

/** Previous / numbered / next pagination that preserves every active filter. */
export default function ShopPagination({ state, page, pages }: Props) {
  if (pages <= 1) return null;

  const numbers = Array.from({ length: pages }, (_, index) => index + 1).filter(
    n => n === 1 || n === pages || Math.abs(n - page) <= 1
  );

  return (
    <nav className="shop-pagination" aria-label="Pagination">
      {page > 1 ? (
        <Link href={shopHref({ ...state, page: page - 1 })} className="page-link" rel="prev">
          ← Previous
        </Link>
      ) : (
        <span className="page-link is-disabled" aria-disabled="true">← Previous</span>
      )}

      <ol className="page-numbers">
        {numbers.map((n, index) => (
          <li key={n}>
            {index > 0 && n - numbers[index - 1] > 1 ? <span className="page-gap">…</span> : null}
            <Link
              href={shopHref({ ...state, page: n })}
              className={`page-number${n === page ? " is-on" : ""}`}
              aria-current={n === page ? "page" : undefined}
            >
              {n}
            </Link>
          </li>
        ))}
      </ol>

      {page < pages ? (
        <Link href={shopHref({ ...state, page: page + 1 })} className="page-link" rel="next">
          Next →
        </Link>
      ) : (
        <span className="page-link is-disabled" aria-disabled="true">Next →</span>
      )}
    </nav>
  );
}

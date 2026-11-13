import Link from "next/link";
import { BRAND } from "@/lib/site-config";
import type { ContentPageData } from "@/lib/content-pages";

/**
 * Shared renderer for the trust and policy pages.
 *
 * Server-rendered and link-only: no client JavaScript is shipped for these
 * pages, so they stay cheap inside the Workers CPU budget.
 */
export default function ContentPage({ page }: { page: ContentPageData }) {
  return (
    <main className="content-page">
      <div className="content-hero">
        <div className="site-shell">
          <span className="content-eyebrow">{page.eyebrow}</span>
          <h1>{page.title}</h1>
          <p className="content-intro">{page.intro}</p>
          <p className="content-meta">Last updated: {page.updated}</p>
        </div>
      </div>

      <div className="site-shell content-body">
        {page.notice ? <p className="content-notice">{page.notice}</p> : null}

        <nav className="content-toc" aria-label="On this page">
          {page.sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.heading}
            </a>
          ))}
        </nav>

        <div className="content-sections">
          {page.sections.map((section) => (
            <section key={section.id} id={section.id} className="content-section">
              <h2>{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets?.length ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="content-foot">
          <p>
            Still need help? Visit the <Link href="/contact">contact page</Link> or read the{" "}
            <Link href="/faq">FAQ</Link>.
          </p>
          <p className="muted-note">
            {BRAND} — preview build. Contact details and legal particulars shown as
            PLACEHOLDER are not yet confirmed business information.
          </p>
        </div>
      </div>
    </main>
  );
}

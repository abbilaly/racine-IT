import Link from "next/link";
import { renderEmailCenterDisabled } from "@/lib/server/email-center-gate";
import { requireAdmin } from "@/lib/server/admin-auth";
import {
  STUDIO_CATEGORIES,
  STUDIO_TEMPLATES,
  STUDIO_VARIABLE_HINTS,
  getStudioTemplate,
  renderStudioTemplate,
} from "@/lib/server/email-template-studio";
import { AdminBreadcrumbs } from "@/components/admin/nav";

export const dynamic = "force-dynamic";
export const metadata = { title: "Studio des modèles" };

type SearchParams = Promise<{ template?: string; device?: string }>;

export default async function TemplateStudioPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  // Screens that need migration 0005 render an explicit disabled state.
  const emailCenterDisabled = renderEmailCenterDisabled();
  if (emailCenterDisabled) return emailCenterDisabled;

  const params = await searchParams;
  const selected = getStudioTemplate(params.template) ?? STUDIO_TEMPLATES[0];
  const device = params.device === "mobile" ? "mobile" : "desktop";
  const rendered = renderStudioTemplate(selected.id);

  if (!rendered) {
    return (
      <div className="admin-page ec-page">
        <div className="admin-error" role="alert">
          <strong>Modèle introuvable</strong>
          <p>Le modèle demandé n&apos;existe pas dans le studio.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page ec-page">
      <AdminBreadcrumbs
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Email Center", href: "/admin/emails" },
          { label: "Studio des modèles" },
        ]}
      />

      <header className="admin-page-header">
        <div className="admin-page-title">
          <h1>Studio des modèles</h1>
          <p className="admin-page-subtitle">
            Modèles d&apos;emails B2B en français, rendus avec des données d&apos;exemple.
            Aucun email n&apos;est envoyé depuis cet écran.
          </p>
        </div>
        <span className="ec-status-pill">Aperçu local · aucun envoi</span>
      </header>

      <div className="studio-layout">
        <nav className="studio-list" aria-label="Modèles disponibles">
          {STUDIO_CATEGORIES.map(category => {
            const group = STUDIO_TEMPLATES.filter(template => template.category === category);
            if (group.length === 0) return null;
            return (
              <div key={category} className="studio-group">
                <p className="studio-group-title">{category}</p>
                {group.map(template => {
                  const active = template.id === selected.id;
                  return (
                    <Link
                      key={template.id}
                      href={`/admin/templates?template=${template.id}&device=${device}`}
                      className={`studio-item${active ? " is-active" : ""}`}
                      aria-current={active ? "page" : undefined}
                    >
                      <span className="studio-item-name">{template.name}</span>
                      <span className="studio-item-purpose">{template.purpose}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <section className="studio-panel" aria-label={`Aperçu du modèle ${selected.name}`}>
          <div className="studio-toolbar">
            <div className="studio-toolbar-text">
              <h2 className="studio-title">{selected.name}</h2>
              <p className="studio-subject">
                <span>Objet :</span> {rendered.subject}
              </p>
            </div>
            <div className="studio-devices" role="group" aria-label="Taille de l'aperçu">
              <Link
                href={`/admin/templates?template=${selected.id}&device=desktop`}
                className={`studio-device${device === "desktop" ? " is-active" : ""}`}
                aria-current={device === "desktop" ? "true" : undefined}
              >
                Bureau
              </Link>
              <Link
                href={`/admin/templates?template=${selected.id}&device=mobile`}
                className={`studio-device${device === "mobile" ? " is-active" : ""}`}
                aria-current={device === "mobile" ? "true" : undefined}
              >
                Mobile
              </Link>
            </div>
          </div>

          {rendered.missing.length > 0 ? (
            <div className="studio-warning" role="status">
              <strong>
                {rendered.missing.length} variable
                {rendered.missing.length > 1 ? "s" : ""} sans valeur d&apos;exemple
              </strong>
              <p>
                Ces emplacements apparaissent dans l&apos;aperçu sous la forme{" "}
                <code>[À RENSEIGNER : nom]</code> : {rendered.missing.join(", ")}.
              </p>
            </div>
          ) : null}

          <div
            className={`studio-frame-wrap${device === "mobile" ? " studio-frame-wrap--mobile" : ""}`}
          >
            <iframe
              className="studio-frame"
              title={`Aperçu du modèle ${selected.name}`}
              srcDoc={rendered.html}
              sandbox=""
            />
          </div>

          <div className="studio-meta">
            <p>
              <strong>Données d&apos;aperçu :</strong> valeurs fictives (société, références et
              montants d&apos;exemple). Aucun client réel n&apos;est représenté.
            </p>
            <p>
              <strong>Aucun envoi :</strong> le rendu est généré côté serveur, sans appel au
              fournisseur d&apos;emails.
            </p>
          </div>

          <h3 className="studio-h3">Variables du modèle</h3>
          <div className="studio-vars">
            {selected.variables.map(name => {
              const missing = rendered.missing.includes(name);
              return (
                <div key={name} className="studio-var">
                  <code className="studio-var-name">{`{{${name}}}`}</code>
                  <span className="studio-var-hint">
                    {STUDIO_VARIABLE_HINTS[name] ?? "Variable du modèle"}
                  </span>
                  <span className={`studio-var-state${missing ? " is-missing" : ""}`}>
                    {missing ? "à renseigner" : "exemple fourni"}
                  </span>
                </div>
              );
            })}
          </div>

          <details className="ec-details">
            <summary>HTML rendu</summary>
            <div className="ec-details-body">
              <pre className="studio-code">{rendered.html}</pre>
            </div>
          </details>

          <details className="ec-details">
            <summary>Version texte</summary>
            <div className="ec-details-body">
              <pre className="studio-code">{rendered.text}</pre>
            </div>
          </details>
        </section>
      </div>
    </div>
  );
}

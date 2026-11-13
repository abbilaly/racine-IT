import Link from "next/link";
import type { ReactNode } from "react";

export interface EmailPreviewPanelProps {
  title: ReactNode;
  backHref: string;
  backLabel: ReactNode;
  /** The sending endpoint this preview mirrors — shown for traceability. */
  sendEndpoint: string;
  recipient: string;
  subject: string;
  html: string | null;
  text: string | null;
  missing: string[];
  device: "desktop" | "mobile";
  deviceHref: (device: "desktop" | "mobile") => string;
}

/**
 * Server-only preview of the exact HTML a send route produces for a record.
 * It renders supplied markup and never fetches, sends or logs anything.
 */
export function EmailPreviewPanel({
  title,
  backHref,
  backLabel,
  sendEndpoint,
  recipient,
  subject,
  html,
  text,
  missing,
  device,
  deviceHref,
}: EmailPreviewPanelProps) {
  return (
    <div className="admin-page ec-page">
      <div className="admin-page-header">
        <Link href={backHref} className="admin-back-link">
          <span aria-hidden="true">←</span>
          {backLabel}
        </Link>
        <div className="admin-page-title">
          <h1>{title}</h1>
          <p className="admin-page-subtitle">
            Rendu exact du message produit par <code>{sendEndpoint}</code>. Aucun email n&apos;est
            envoyé, enregistré dans l&apos;historique ni transmis au fournisseur.
          </p>
        </div>
        <span className="ec-status-pill">Aperçu · aucun envoi</span>
      </div>

      <section className="studio-panel" aria-label="Aperçu de l'email">
        <div className="studio-toolbar">
          <div className="studio-toolbar-text">
            <h2 className="studio-title">Objet</h2>
            <p className="studio-subject">{subject || "—"}</p>
            <p className="studio-subject">
              <span>Destinataire prévu :</span> {recipient}
            </p>
          </div>
          <div className="studio-devices" role="group" aria-label="Taille de l'aperçu">
            <Link
              href={deviceHref("desktop")}
              className={`studio-device${device === "desktop" ? " is-active" : ""}`}
              aria-current={device === "desktop" ? "true" : undefined}
            >
              Bureau
            </Link>
            <Link
              href={deviceHref("mobile")}
              className={`studio-device${device === "mobile" ? " is-active" : ""}`}
              aria-current={device === "mobile" ? "true" : undefined}
            >
              Mobile
            </Link>
          </div>
        </div>

        {missing.length > 0 ? (
          <div className="studio-warning" role="alert">
            <strong>
              Données manquantes : {missing.join(", ")}
            </strong>
            <p>
              L&apos;envoi réel serait refusé (réponse 422, sans email ni ligne d&apos;historique)
              tant que ces informations ne sont pas renseignées sur la fiche. Aucun texte de
              remplacement n&apos;est présenté comme définitif.
            </p>
          </div>
        ) : null}

        {html ? (
          <div
            className={`studio-frame-wrap${device === "mobile" ? " studio-frame-wrap--mobile" : ""}`}
          >
            <iframe
              className="studio-frame"
              title="Aperçu du message"
              srcDoc={html}
              sandbox=""
            />
          </div>
        ) : (
          <div className="admin-error" role="alert">
            <strong>Message non généré</strong>
            <p>Les données actuelles de cet enregistrement ne suffisent pas pour produire l&apos;email.</p>
          </div>
        )}

        <div className="studio-meta">
          <p>
            <strong>Données réelles :</strong> ce rendu utilise l&apos;enregistrement affiché, pas
            les données d&apos;exemple du Studio des modèles.
          </p>
          <p>
            <strong>Aucun envoi :</strong> l&apos;aperçu est calculé côté serveur, sans appel à
            Resend.
          </p>
        </div>

        <details className="ec-details">
          <summary>HTML exact</summary>
          <div className="ec-details-body">
            <pre className="studio-code">{html ?? ""}</pre>
          </div>
        </details>

        {text ? (
          <details className="ec-details">
            <summary>Version texte</summary>
            <div className="ec-details-body">
              <pre className="studio-code">{text}</pre>
            </div>
          </details>
        ) : null}
      </section>
    </div>
  );
}

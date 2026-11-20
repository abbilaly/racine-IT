/**
 * Racine IT — Studio de modèles d'emails (français, B2B).
 *
 * A single source of truth for the reusable, preview-only email templates that
 * administrators browse in the Email Center. Nothing in this module sends mail:
 * it only renders HTML and text with clearly-labelled sample data.
 *
 * Variable syntax: {{snake_case}} — the same placeholder style used across the
 * studio. Unresolved placeholders are never silently dropped: they render as
 * "[À RENSEIGNER : nom]" and are reported to the caller in `missing`.
 *
 * Brand tokens reuse the colours already present in the project's transactional
 * emails (#0b2e4f header, #f3f4f6 canvas, #e5e7eb borders). No price, warranty,
 * delivery promise or contact detail is invented here; everything factual comes
 * from a variable so the administrator supplies it.
 */

import { DEFAULT_CURRENCY } from "@/lib/currency";

/* ------------------------------------------------------------------ types */

export const STUDIO_CATEGORIES = [
  "Transactionnel",
  "Relance",
  "Commercial",
] as const;

export type StudioCategory = (typeof STUDIO_CATEGORIES)[number];

export type StudioRenderContext = {
  /** Interpolate then HTML-escape — use inside HTML text nodes. */
  h: (raw: string) => string;
  /** Interpolate without escaping — use for subjects and plain text. */
  text: (raw: string) => string;
  /** Interpolate then validate as an http(s) URL — use for href values. */
  url: (raw: string) => string;
  rows: (pairs: ReadonlyArray<readonly [string, string]>) => string;
  button: (href: string, label: string) => string;
  list: (items: ReadonlyArray<string>) => string;
  /** CTA button plus its copy-link fallback, or nothing when the URL is unusable. */
  cta: (href: string, label: string) => string;
};

export type StudioTemplate = {
  id: string;
  name: string;
  purpose: string;
  category: StudioCategory;
  subject: string;
  preheader: string;
  variables: ReadonlyArray<string>;
  sample: Record<string, string>;
  footerNote?: string;
  build: (ctx: StudioRenderContext) => string;
  buildText: (ctx: StudioRenderContext) => string;
};

export type StudioRenderResult = {
  template: StudioTemplate;
  subject: string;
  html: string;
  text: string;
  /** Variable names that had no value in the sample data. */
  missing: string[];
};

/* -------------------------------------------------------------- variables */

export const STUDIO_VARIABLE_HINTS: Record<string, string> = {
  customer_name: "Nom du destinataire (contact ou interlocuteur)",
  company_name: "Raison sociale du client",
  invoice_number: "Numéro de facture",
  invoice_date: "Date d'émission de la facture",
  due_date: "Date d'échéance de paiement",
  amount: "Montant, sans symbole (ex. 1 240,00)",
  currency: "Devise affichée (ex. MAD)",
  quote_number: "Numéro de devis",
  quote_valid_until: "Date de fin de validité du devis",
  order_number: "Numéro de commande",
  ticket_number: "Référence du ticket de support",
  product_name: "Produit ou solution concernée",
  product_summary: "Résumé technique ou commercial de l'offre",
  action_url: "Lien sécurisé vers la facture, le devis, la commande ou le ticket",
  payment_instructions: "Instructions de règlement fournies par Racine IT",
  contact_email: "Adresse de contact Racine IT affichée en pied de message",
};

const SAMPLE: Record<string, string> = {
  customer_name: "Camille Durand (exemple)",
  company_name: "Société Exemple SAS",
  invoice_number: "FAC-2026-0142",
  invoice_date: "12/03/2026",
  due_date: "11/04/2026",
  amount: "1 240,00",
  currency: DEFAULT_CURRENCY,
  quote_number: "DEV-2026-0087",
  quote_valid_until: "30/04/2026",
  order_number: "CMD-2026-0311",
  ticket_number: "SUP-2026-0456",
  product_name: "Serveur rack 2U (configuration d'exemple)",
  product_summary: "2 processeurs · 128 Go de mémoire · 4 SSD 1,92 To · garantie constructeur",
  action_url: "https://exemple.invalid/document/FAC-2026-0142",
  payment_instructions:
    "Virement bancaire — les coordonnées sont transmises par votre interlocuteur Racine IT.",
};

const PLACEHOLDER = /{{\s*([a-z0-9_]+)\s*}}/g;
const MISSING_MARKER = (name: string) => `[À RENSEIGNER : ${name}]`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createContext(
  data: Record<string, string>,
  missing: Set<string>
): StudioRenderContext {
  const interpolate = (raw: string, escape: boolean): string =>
    raw.replace(PLACEHOLDER, (_match, name: string) => {
      const value = data[name];
      if (value === undefined || value.trim() === "") {
        missing.add(name);
        return MISSING_MARKER(name);
      }
      return escape ? escapeHtml(value) : value;
    });

  const h = (raw: string) => interpolate(raw, true);
  const text = (raw: string) => interpolate(raw, false);
  const url = (raw: string) => {
    const value = text(raw);
    return /^https?:\/\//i.test(value) ? escapeHtml(value) : "#";
  };

  const rows = (pairs: ReadonlyArray<readonly [string, string]>) =>
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">${pairs
      .map(
        ([label, value]) =>
          `<tr><td style="padding:9px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-size:13px;color:#6b7280;width:42%;">${h(
            label
          )}</td><td style="padding:9px 12px;border:1px solid #e5e7eb;font-size:14px;color:#111827;">${h(
            value
          )}</td></tr>`
      )
      .join("")}</table>`;

  const button = (href: string, label: string) =>
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;"><tr><td style="border-radius:8px;background:#0b2e4f;"><a href="${url(
      href
    )}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${h(
      label
    )}</a></td></tr></table>`;

  const list = (items: ReadonlyArray<string>) =>
    `<ul style="margin:0 0 20px;padding-left:18px;color:#374151;font-size:14px;line-height:1.7;">${items
      .map((item) => `<li style="margin:0 0 6px;">${h(item)}</li>`)
      .join("")}</ul>`;

  const cta = (href: string, label: string) => {
    const resolved = url(href);
    if (resolved === "#") return "";
    return `${button(href, label)}<p style="margin:-8px 0 18px;font-size:12px;line-height:1.6;color:#6b7280;">${h(
      "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur : "
    )}<span style="word-break:break-all;">${resolved}</span></p>`;
  };

  return { h, text, url, rows, button, list, cta };
}

/* ----------------------------------------------------------------- layout */

function renderEmailDocument(options: {
  title: string;
  preheader: string;
  content: string;
  contactLine: string;
  footerNote?: string;
}): string {
  const { title, preheader, content, contactLine, footerNote } = options;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(
    preheader
  )}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:22px 24px;background-color:#0b2e4f;">
              <div style="font-size:19px;font-weight:700;letter-spacing:0.14em;color:#ffffff;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Racine&nbsp;IT</div>
              <div style="margin-top:6px;font-size:12px;color:#c7d5e3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Matériel et services informatiques pour les entreprises</div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px;background-color:#f9fafb;border-top:1px solid #e5e7eb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 6px;font-size:12px;color:#6b7280;line-height:1.6;">${contactLine}</p>
              <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">Racine IT — matériel, infrastructure, infogérance et cybersécurité pour les entreprises. Ce message est adressé à son destinataire dans le cadre de la relation commerciale avec Racine IT.</p>
              ${
                footerNote
                  ? `<p style="margin:8px 0 0;font-size:11px;color:#9ca3af;line-height:1.6;">${footerNote}</p>`
                  : ""
              }
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/* -------------------------------------------------------------- templates */

const heading = (ctx: StudioRenderContext, text: string) =>
  `<h1 style="margin:0 0 14px;font-size:20px;line-height:1.3;color:#111827;">${ctx.h(text)}</h1>`;

const para = (ctx: StudioRenderContext, text: string) =>
  `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151;">${ctx.h(text)}</p>`;

export const STUDIO_TEMPLATES: ReadonlyArray<StudioTemplate> = [
  {
    id: "facture",
    name: "Facture",
    purpose: "Transmission d'une facture avec référence, montant et échéance.",
    category: "Transactionnel",
    subject: "Facture {{invoice_number}} — {{company_name}}",
    preheader: "Votre facture {{invoice_number}} est disponible.",
    variables: [
      "customer_name",
      "company_name",
      "invoice_number",
      "invoice_date",
      "due_date",
      "amount",
      "currency",
      "action_url",
      "contact_email",
    ],
    sample: SAMPLE,
    build: (ctx) => `
      ${heading(ctx, "Votre facture {{invoice_number}}")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Veuillez trouver votre facture émise au nom de {{company_name}}.")}
      ${ctx.rows([
        ["Numéro de facture", "{{invoice_number}}"],
        ["Date d'émission", "{{invoice_date}}"],
        ["Échéance", "{{due_date}}"],
        ["Montant dû", "{{amount}} {{currency}}"],
      ])}
      ${ctx.cta("{{action_url}}", "Consulter ou télécharger la facture")}
      ${para(ctx, "Le règlement est attendu au plus tard le {{due_date}}. Les modalités de paiement figurent sur la facture.")}
      ${para(ctx, "Si vous constatez une anomalie, répondez à ce message en précisant la référence {{invoice_number}}.")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text("Votre facture {{invoice_number}} ({{company_name}}) est disponible."),
        ctx.text("Date d'émission : {{invoice_date}}"),
        ctx.text("Échéance : {{due_date}}"),
        ctx.text("Montant dû : {{amount}} {{currency}}"),
        "",
        ctx.text("Consulter la facture : {{action_url}}"),
        "",
      ].join("\n"),
  },
  {
    id: "devis",
    name: "Devis",
    purpose: "Envoi d'un devis avec référence, validité, résumé et montant.",
    category: "Transactionnel",
    subject: "Devis {{quote_number}} — {{company_name}}",
    preheader: "Votre devis {{quote_number}} est disponible jusqu'au {{quote_valid_until}}.",
    variables: [
      "customer_name",
      "company_name",
      "quote_number",
      "quote_valid_until",
      "product_name",
      "product_summary",
      "amount",
      "currency",
      "action_url",
      "contact_email",
    ],
    sample: SAMPLE,
    build: (ctx) => `
      ${heading(ctx, "Devis {{quote_number}}")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Nous vous transmettons le devis préparé pour {{company_name}}.")}
      ${ctx.rows([
        ["Référence", "{{quote_number}}"],
        ["Validité", "jusqu'au {{quote_valid_until}}"],
        ["Solution proposée", "{{product_name}}"],
        ["Résumé", "{{product_summary}}"],
        ["Montant total", "{{amount}} {{currency}}"],
      ])}
      ${ctx.cta("{{action_url}}", "Consulter et accepter le devis")}
      ${para(ctx, "Le devis reste consultable jusqu'au {{quote_valid_until}}. Toute demande d'ajustement peut être formulée en réponse à ce message.")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text("Devis {{quote_number}} pour {{company_name}}."),
        ctx.text("Solution : {{product_name}}"),
        ctx.text("Résumé : {{product_summary}}"),
        ctx.text("Montant total : {{amount}} {{currency}}"),
        ctx.text("Valable jusqu'au {{quote_valid_until}}."),
        "",
        ctx.text("Consulter le devis : {{action_url}}"),
        "",
      ].join("\n"),
  },
  {
    id: "relance_devis",
    name: "Relance de devis",
    purpose: "Relance courtoise après l'envoi d'un devis.",
    category: "Relance",
    subject: "Relance — devis {{quote_number}}",
    preheader: "Votre devis {{quote_number}} est toujours consultable.",
    variables: [
      "customer_name",
      "company_name",
      "quote_number",
      "quote_valid_until",
      "amount",
      "currency",
      "action_url",
      "contact_email",
    ],
    sample: SAMPLE,
    build: (ctx) => `
      ${heading(ctx, "Suivi de votre devis {{quote_number}}")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Nous revenons vers vous au sujet du devis {{quote_number}} transmis à {{company_name}}.")}
      ${ctx.rows([
        ["Référence", "{{quote_number}}"],
        ["Montant", "{{amount}} {{currency}}"],
        ["Validité", "jusqu'au {{quote_valid_until}}"],
      ])}
      ${para(ctx, "Si le devis vous convient, vous pouvez l'accepter directement. Si des précisions ou des ajustements sont nécessaires, répondez simplement à ce message : nous adapterons la proposition.")}
      ${ctx.cta("{{action_url}}", "Revoir le devis")}
      ${para(ctx, "Sans retour de votre part, le devis restera consultable jusqu'au {{quote_valid_until}}.")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text("Nous revenons vers vous au sujet du devis {{quote_number}} ({{company_name}})."),
        ctx.text("Montant : {{amount}} {{currency}} — valable jusqu'au {{quote_valid_until}}."),
        "",
        ctx.text("Revoir le devis : {{action_url}}"),
        "",
      ].join("\n"),
  },
  {
    id: "offre_commerciale",
    name: "Offre commerciale",
    purpose: "Présentation d'une solution avec bénéfices, tarification et appel à l'action.",
    category: "Commercial",
    subject: "Offre commerciale — {{product_name}}",
    preheader: "Une proposition pour {{company_name}}.",
    variables: [
      "customer_name",
      "company_name",
      "product_name",
      "product_summary",
      "amount",
      "currency",
      "action_url",
      "contact_email",
    ],
    sample: SAMPLE,
    build: (ctx) => `
      ${heading(ctx, "Une proposition pour {{company_name}}")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Nous avons préparé une proposition autour de {{product_name}} pour {{company_name}}.")}
      ${ctx.rows([
        ["Solution", "{{product_name}}"],
        ["Résumé", "{{product_summary}}"],
        ["Montant proposé", "{{amount}} {{currency}}"],
      ])}
      ${para(ctx, "Ce que comprend l'accompagnement Racine IT :")}
      ${ctx.list([
        "Sélection de matériel professionnel adapté à l'usage en entreprise",
        "Intégration et mise en service par nos équipes",
        "Solutions évolutives : infrastructure, stockage, sauvegarde, réseau",
        "Accompagnement et infogérance selon vos besoins",
      ])}
      ${ctx.cta("{{action_url}}", "Demander un devis détaillé")}
      ${para(ctx, "Les conditions définitives sont confirmées dans le devis établi après échange sur votre besoin.")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text("Proposition pour {{company_name}} : {{product_name}}"),
        ctx.text("Résumé : {{product_summary}}"),
        ctx.text("Montant proposé : {{amount}} {{currency}}"),
        "",
        ctx.text("Demander un devis détaillé : {{action_url}}"),
        "",
      ].join("\n"),
  },
  {
    id: "campagne_marketing_b2b",
    name: "Campagne marketing B2B",
    purpose: "Annonce de produits, solutions entreprises et actualités.",
    category: "Commercial",
    subject: "Actualités Racine IT — {{product_name}}",
    preheader: "Nouveautés et solutions informatiques pour les entreprises.",
    variables: [
      "customer_name",
      "company_name",
      "product_name",
      "product_summary",
      "action_url",
      "contact_email",
    ],
    sample: SAMPLE,
    footerNote:
      "Si vous ne souhaitez plus recevoir nos actualités professionnelles, répondez à ce message avec la mention « désinscription ».",
    build: (ctx) => `
      ${heading(ctx, "Nouveautés Racine IT")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Voici une sélection de solutions destinées aux entreprises, à commencer par {{product_name}}.")}
      ${para(ctx, "{{product_summary}}")}
      ${ctx.list([
        "Serveurs, postes de travail et stockage professionnels",
        "Infrastructure et réseau : Proxmox, Ceph, Nextcloud, Zabbix",
        "Sauvegarde, reprise après sinistre et cybersécurité",
        "Matériel neuf et reconditionné premium selon les besoins",
      ])}
      ${ctx.cta("{{action_url}}", "Découvrir les solutions")}
      ${para(ctx, "Vous recevez ce message dans un cadre professionnel. Aucune offre commerciale ne vous est adressée sans votre accord.")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text("Nouveautés Racine IT pour {{company_name}} : {{product_name}}"),
        ctx.text("{{product_summary}}"),
        "",
        ctx.text("Découvrir les solutions : {{action_url}}"),
        "",
        ctx.text(
          "Pour ne plus recevoir nos actualités, répondez avec la mention « désinscription »."
        ),
      ].join("\n"),
  },
  {
    id: "prospection_b2b",
    name: "Prospection B2B",
    purpose: "Prise de contact concise auprès d'un prospect professionnel.",
    category: "Commercial",
    subject: "Racine IT — matériel et services informatiques pour {{company_name}}",
    preheader: "Prise de contact professionnelle.",
    variables: [
      "customer_name",
      "company_name",
      "action_url",
      "contact_email",
    ],
    sample: SAMPLE,
    footerNote:
      "Si cette approche ne concerne pas votre entreprise, répondez à ce message et nous ne reviendrons plus vers vous.",
    build: (ctx) => `
      ${heading(ctx, "Équipement et services informatiques pour {{company_name}}")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Racine IT accompagne les entreprises sur le matériel informatique et les services qui l'entourent.")}
      ${ctx.list([
        "Serveurs, postes de travail et stockage",
        "Infrastructure et réseau : Proxmox, Ceph, Nextcloud, Zabbix",
        "Sauvegarde, reprise après sinistre et cybersécurité",
        "Infogérance et accompagnement au quotidien",
      ])}
      ${para(ctx, "Si un sujet correspond à vos priorités actuelles, nous pouvons en discuter lors d'un échange court et sans engagement.")}
      ${ctx.cta("{{action_url}}", "Planifier un échange")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text(
          "Racine IT accompagne les entreprises sur le matériel informatique, l'infrastructure, la sauvegarde, la cybersécurité et l'infogérance."
        ),
        ctx.text("Nous pouvons échanger brièvement si un sujet correspond à vos priorités."),
        "",
        ctx.text("Planifier un échange : {{action_url}}"),
        "",
      ].join("\n"),
  },
  {
    id: "confirmation_commande",
    name: "Confirmation de commande",
    purpose: "Accusé de réception d'une commande avec référence, résumé et prochaines étapes.",
    category: "Transactionnel",
    subject: "Confirmation de commande {{order_number}}",
    preheader: "Nous avons bien reçu votre commande {{order_number}}.",
    variables: [
      "customer_name",
      "company_name",
      "order_number",
      "product_name",
      "product_summary",
      "amount",
      "currency",
      "action_url",
      "contact_email",
    ],
    sample: SAMPLE,
    build: (ctx) => `
      ${heading(ctx, "Commande {{order_number}} enregistrée")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Nous confirmons la réception de la commande passée par {{company_name}}.")}
      ${ctx.rows([
        ["Numéro de commande", "{{order_number}}"],
        ["Article principal", "{{product_name}}"],
        ["Détail", "{{product_summary}}"],
        ["Montant", "{{amount}} {{currency}}"],
        ["Statut", "Commande enregistrée"],
      ])}
      ${ctx.cta("{{action_url}}", "Suivre la commande")}
      ${para(ctx, "Prochaines étapes : vérification de la disponibilité, confirmation du délai par votre interlocuteur, puis préparation de la commande. Aucune date d'expédition n'est engagée dans ce message.")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text("Commande {{order_number}} enregistrée pour {{company_name}}."),
        ctx.text("Article : {{product_name}}"),
        ctx.text("Détail : {{product_summary}}"),
        ctx.text("Montant : {{amount}} {{currency}}"),
        "",
        ctx.text("Suivre la commande : {{action_url}}"),
        "",
      ].join("\n"),
  },
  {
    id: "support_maintenance",
    name: "Support et maintenance",
    purpose: "Accusé de réception d'une demande de support et suivi de ticket.",
    category: "Transactionnel",
    subject: "Support Racine IT — ticket {{ticket_number}}",
    preheader: "Votre demande {{ticket_number}} a été enregistrée.",
    variables: [
      "customer_name",
      "company_name",
      "ticket_number",
      "product_summary",
      "action_url",
      "contact_email",
    ],
    sample: SAMPLE,
    build: (ctx) => `
      ${heading(ctx, "Demande de support {{ticket_number}}")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Nous avons enregistré la demande adressée par {{company_name}}.")}
      ${ctx.rows([
        ["Référence du ticket", "{{ticket_number}}"],
        ["Objet", "{{product_summary}}"],
        ["Statut", "Demande reçue"],
      ])}
      ${para(ctx, "Un technicien analyse votre demande et vous tiendra informé de son avancement. Le statut du ticket est mis à jour au fil du traitement.")}
      ${ctx.cta("{{action_url}}", "Consulter le ticket")}
      ${para(ctx, "Merci d'indiquer la référence {{ticket_number}} dans tout échange complémentaire.")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text("Ticket {{ticket_number}} enregistré pour {{company_name}}."),
        ctx.text("Objet : {{product_summary}}"),
        ctx.text("Statut : demande reçue."),
        "",
        ctx.text("Consulter le ticket : {{action_url}}"),
        "",
      ].join("\n"),
  },
  {
    id: "relance_paiement",
    name: "Relance de paiement",
    purpose: "Rappel professionnel de paiement avec référence et instructions.",
    category: "Relance",
    subject: "Rappel de paiement — facture {{invoice_number}}",
    preheader: "Rappel concernant la facture {{invoice_number}}.",
    variables: [
      "customer_name",
      "company_name",
      "invoice_number",
      "due_date",
      "amount",
      "currency",
      "payment_instructions",
      "action_url",
      "contact_email",
    ],
    sample: SAMPLE,
    build: (ctx) => `
      ${heading(ctx, "Rappel — facture {{invoice_number}}")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Sauf erreur de notre part, la facture {{invoice_number}} adressée à {{company_name}} reste en attente de règlement.")}
      ${ctx.rows([
        ["Facture", "{{invoice_number}}"],
        ["Échéance", "{{due_date}}"],
        ["Montant", "{{amount}} {{currency}}"],
      ])}
      ${para(ctx, "Modalités de règlement : {{payment_instructions}}")}
      ${ctx.cta("{{action_url}}", "Consulter la facture")}
      ${para(ctx, "Si le règlement a déjà été effectué, merci d'ignorer ce message. Pour toute question, répondez en indiquant la référence {{invoice_number}}.")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text("Rappel : la facture {{invoice_number}} ({{company_name}}) reste en attente de règlement."),
        ctx.text("Échéance : {{due_date}}"),
        ctx.text("Montant : {{amount}} {{currency}}"),
        ctx.text("Modalités : {{payment_instructions}}"),
        "",
        ctx.text("Consulter la facture : {{action_url}}"),
        "",
        ctx.text("Si le règlement a déjà été effectué, merci d'ignorer ce message."),
      ].join("\n"),
  },
  {
    id: "email_test",
    name: "Email de test",
    purpose: "Message simple pour vérifier la configuration et le rendu.",
    category: "Transactionnel",
    subject: "Racine IT — email de test",
    preheader: "Message de test envoyé depuis le Studio de modèles.",
    variables: ["customer_name", "company_name", "action_url", "contact_email"],
    sample: SAMPLE,
    build: (ctx) => `
      ${heading(ctx, "Email de test")}
      ${para(ctx, "Bonjour {{customer_name}},")}
      ${para(ctx, "Ceci est un message de test destiné à vérifier la configuration d'envoi et le rendu des emails Racine IT.")}
      ${ctx.rows([
        ["Destinataire", "{{customer_name}}"],
        ["Société", "{{company_name}}"],
        ["Type", "Email de test"],
      ])}
      ${para(ctx, "Aucune action n'est requise. Aucune donnée client réelle n'est utilisée dans ce message.")}
      ${ctx.cta("{{action_url}}", "Ouvrir le site Racine IT")}
    `,
    buildText: (ctx) =>
      [
        ctx.text("Bonjour {{customer_name}},"),
        "",
        ctx.text(
          "Ceci est un email de test destiné à vérifier la configuration d'envoi et le rendu des emails Racine IT."
        ),
        ctx.text("Aucune action n'est requise."),
        "",
      ].join("\n"),
  },
];

/* -------------------------------------------------------------- rendering */

export function getStudioTemplate(id: string | undefined): StudioTemplate | undefined {
  if (!id) return undefined;
  return STUDIO_TEMPLATES.find((template) => template.id === id);
}

/**
 * Renders a template with its sample data. Nothing is sent, persisted or
 * fetched; unresolved variables are reported in `missing` and rendered as
 * explicit "[À RENSEIGNER : …]" markers.
 */
export function renderStudioTemplate(
  id: string,
  overrides: Record<string, string> = {}
): StudioRenderResult | null {
  const template = getStudioTemplate(id);
  if (!template) return null;

  const data: Record<string, string> = { ...template.sample, ...overrides };
  const missing = new Set<string>();
  const ctx = createContext(data, missing);

  const content = template.build(ctx);

  const html = renderEmailDocument({
    title: template.name,
    preheader: ctx.text(template.preheader),
    content,
    contactLine: ctx.h("Une question ? Écrivez-nous à {{contact_email}}."),
    footerNote: template.footerNote ? ctx.h(template.footerNote) : undefined,
  });

  return {
    template,
    subject: ctx.text(template.subject),
    html,
    text: template.buildText(ctx),
    missing: Array.from(missing),
  };
}

/* ------------------------------------------------- real-send entry point */

export type StudioSendRender =
  | {
      ok: true;
      templateId: string;
      subject: string;
      html: string;
      text: string;
      /** Substituted-but-unused variables; informational only. */
      missing: string[];
    }
  | { ok: false; templateId: string; missing: string[] };

/**
 * Renders a template for an actual send. Unlike the preview renderer this uses
 * no sample data: an unavailable variable fails the render instead of printing
 * a placeholder to a customer.
 */
export function renderStudioTemplateForSend(
  id: string,
  values: Record<string, string>,
  options: { allowMissing?: ReadonlyArray<string> } = {}
): StudioSendRender {
  const template = getStudioTemplate(id);
  if (!template) return { ok: false, templateId: id, missing: ["template"] };

  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value.trim() !== "") data[key] = value.trim();
  }

  const allowed = new Set(options.allowMissing ?? []);
  const missing = new Set<string>();
  const ctx = createContext(data, missing);
  const content = template.build(ctx);
  const contact = data.contact_email ?? "";
  const textBody = template.buildText(ctx);
  const text = contact ? `${textBody}\n\nRacine IT — ${contact}` : textBody;

  const html = renderEmailDocument({
    title: template.name,
    preheader: ctx.text(template.preheader),
    content,
    contactLine: contact ? `Une question ? Écrivez-nous à ${escapeHtml(contact)}.` : "",
    footerNote: template.footerNote ? ctx.h(template.footerNote) : undefined,
  });

  const unresolved = Array.from(missing).filter((name) => !allowed.has(name));
  if (unresolved.length > 0) {
    return { ok: false, templateId: template.id, missing: unresolved };
  }

  return {
    ok: true,
    templateId: template.id,
    subject: ctx.text(template.subject),
    html,
    text,
    missing: Array.from(missing),
  };
}

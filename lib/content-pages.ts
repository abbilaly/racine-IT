/**
 * Content for the AB Tech trust and policy pages.
 *
 * Everything factual about the business itself (legal entity, address, phone,
 * delivery windows, carriers, return period, jurisdiction) is a PLACEHOLDER and
 * is rendered as one: the store must never publish invented business facts.
 * Product-level facts (manufacturer warranty, item condition) are always read
 * from the product record, never restated here.
 */

export type ContentSection = {
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type ContentPageData = {
  slug: string;
  title: string;
  eyebrow: string;
  intro: string;
  updated: string;
  /** Shown as a highlighted banner when the page still needs business input. */
  notice?: string;
  sections: ContentSection[];
};

const UPDATED = "November 2026";

const DRAFT =
  "Draft for launch review. Items marked PLACEHOLDER must be replaced with confirmed business details before this page is published as final.";

export const CONTENT_PAGES: Record<string, ContentPageData> = {
  about: {
    slug: "about",
    eyebrow: "About us",
    title: "AB Tech",
    intro:
      "AB Tech is an online electronics store. We list phones, laptops, tablets, audio, wearables and accessories from recognised manufacturers, and we publish the technical specifications that come with each model.",
    updated: UPDATED,
    notice: DRAFT,
    sections: [
      {
        id: "what-we-sell",
        heading: "What we sell",
        paragraphs: [
          "Our catalogue is organised into categories such as computers and laptops, smartphones and tablets, multimedia and audio, wearables, and the accessories that go with them. Every product page lists the model, the brand and the specifications we hold for that item.",
        ],
        bullets: [
          "Specifications are taken from the manufacturer or distributor data for that exact model.",
          "If we do not hold a verified price for an item, the product page says the price requires confirmation instead of showing an estimate.",
          "Stock status reflects what our catalogue records, not a promise of next-day availability.",
        ],
      },
      {
        id: "how-we-work",
        heading: "How we work",
        paragraphs: [
          "Products are sourced through distribution channels and listed under their original brand and model identifiers. Listing a product does not imply that AB Tech is an authorised dealer, partner or representative of that manufacturer; any such statement would require a separate, documented agreement.",
          "Orders can be placed as a guest or from an account. You can follow an order with the reference you receive at checkout.",
        ],
      },
      {
        id: "business-details",
        heading: "Business details",
        paragraphs: [
          "PLACEHOLDER — legal business name, registered address and company registration number.",
          "PLACEHOLDER — trading address and customer-service hours.",
        ],
      },
      {
        id: "contact",
        heading: "Talk to us",
        paragraphs: [
          "Questions about a product, an order or a quotation are welcome through the contact page. Contact details on this site are preview placeholders until the business supplies final ones.",
        ],
      },
    ],
  },

  contact: {
    slug: "contact",
    eyebrow: "Customer support",
    title: "Contact AB Tech",
    intro:
      "Use the details below for product questions, order support and wholesale enquiries. The email address and phone number shown are preview placeholders.",
    updated: UPDATED,
    notice: DRAFT,
    sections: [
      {
        id: "channels",
        heading: "Contact channels",
        bullets: [
          "Email: PLACEHOLDER — support@abtech.example (replace with the monitored support mailbox).",
          "Phone: PLACEHOLDER — +1 (555) 010-0000 (replace with the business line and its opening hours).",
          "Postal address: PLACEHOLDER — registered business address.",
        ],
      },
      {
        id: "orders",
        heading: "Order support",
        paragraphs: [
          "For a question about an existing order, have the order reference from your confirmation ready. If you checked out with an account, the order and its current status are also listed under your account.",
        ],
        bullets: [
          "Order tracking: open your account, or use the order reference page.",
          "Change or cancel a request: contact us before the order is dispatched.",
          "Damaged or incorrect item: report it with photos of the packaging and the item.",
        ],
      },
      {
        id: "wholesale",
        heading: "Wholesale and business enquiries",
        paragraphs: [
          "Quantities, lead times and trade pricing are quoted per request. A quotation is not an order, and prices quoted for trade quantities are separate from the retail prices shown in the catalogue.",
        ],
      },
      {
        id: "response",
        heading: "Response times",
        paragraphs: [
          "PLACEHOLDER — publish a response-time commitment only once the support mailbox is live and staffed.",
        ],
      },
    ],
  },

  shipping: {
    slug: "shipping",
    eyebrow: "Delivery",
    title: "Shipping and delivery",
    intro:
      "Delivery options and their charges are shown in the cart and at checkout before an order is placed. This page explains what happens after you order.",
    updated: UPDATED,
    notice: DRAFT,
    sections: [
      {
        id: "options",
        heading: "Delivery options and charges",
        paragraphs: [
          "The delivery methods available for your basket, and what each one costs, are calculated at checkout from the store's current delivery settings. If a method is unavailable for your address, it is not offered.",
        ],
        bullets: [
          "The order confirmation records the delivery method, the charge and the total you agreed to.",
          "Changing a delivery address after dispatch is not possible; contact us as soon as possible if you spot a mistake.",
        ],
      },
      {
        id: "dispatch",
        heading: "Dispatch and delivery times",
        paragraphs: [
          "PLACEHOLDER — dispatch cut-off time, handling time and expected transit times per destination.",
          "PLACEHOLDER — carriers used, and whether tracking is included on every service.",
          "Delivery estimates are estimates. They are not a guaranteed delivery date unless a service explicitly says so.",
        ],
      },
      {
        id: "tracking",
        heading: "Tracking your order",
        paragraphs: [
          "When an order is handed to a carrier, tracking details are added to the order. You can check the status from your account, or from the order reference page using the reference from your confirmation.",
        ],
      },
      {
        id: "restrictions",
        heading: "Restrictions",
        paragraphs: [
          "PLACEHOLDER — countries and regions served, and any item categories that cannot be shipped to particular destinations (for example lithium batteries).",
        ],
      },
    ],
  },

  returns: {
    slug: "returns",
    eyebrow: "After-sales",
    title: "Returns and refunds",
    intro:
      "If something is wrong with an order, contact us and we will explain the options that apply to that item. Your statutory rights are not affected by anything on this page.",
    updated: UPDATED,
    notice: DRAFT,
    sections: [
      {
        id: "window",
        heading: "Return window",
        paragraphs: [
          "PLACEHOLDER — return period counted from delivery, and whether it differs for unopened and opened items.",
          "PLACEHOLDER — the address returns should be sent to, and who pays return carriage.",
        ],
      },
      {
        id: "condition",
        heading: "Condition of returned items",
        bullets: [
          "Return the item with its accessories, manuals and original packaging where possible.",
          "Opened items are inspected before a refund is approved; normal inspection is allowed, use beyond that may reduce the refund.",
          "For hygiene or consumable items, and for digital licences or codes, PLACEHOLDER — state the policy that applies.",
        ],
      },
      {
        id: "damaged",
        heading: "Damaged, faulty or incorrect items",
        paragraphs: [
          "Report a damaged or incorrect item as soon as you receive it, with photos of the packaging and the item. Faulty goods are handled under the manufacturer's warranty and your statutory rights; the warranty terms for a specific model are those published by its manufacturer.",
        ],
      },
      {
        id: "refunds",
        heading: "Refunds",
        paragraphs: [
          "Approved refunds are returned to the original payment method. PLACEHOLDER — the processing time to state once the payment provider is confirmed.",
        ],
      },
    ],
  },

  privacy: {
    slug: "privacy",
    eyebrow: "Legal",
    title: "Privacy notice",
    intro:
      "This notice explains what personal data AB Tech processes to run the store, why it is processed, and the choices you have.",
    updated: UPDATED,
    notice: DRAFT,
    sections: [
      {
        id: "data",
        heading: "What we collect",
        bullets: [
          "Order details: the name, delivery address, email address and phone number you enter at checkout, plus what you ordered.",
          "Account details, only if you create an account: your email address and the credentials managed by our authentication provider.",
          "Technical data: the requests your browser makes to the store, including IP address and error diagnostics, retained by our hosting provider for security and reliability.",
          "Local browser storage for your cart, wishlist and comparison list. These are stored in your browser, not used for advertising.",
        ],
      },
      {
        id: "why",
        heading: "Why we process it",
        bullets: [
          "To accept, fulfil and support orders, and to handle returns and warranty questions.",
          "To keep the store secure and available, including fraud prevention and abuse detection.",
          "To meet accounting and legal record-keeping obligations where they apply.",
        ],
      },
      {
        id: "processors",
        heading: "Service providers",
        paragraphs: [
          "The store runs on Cloudflare (hosting and network) and stores its catalogue, customer and order records in Supabase (managed Postgres database and authentication). These providers process data on our behalf to deliver the service.",
          "PLACEHOLDER — add the payment provider, email delivery provider and any analytics tool once they are actually connected.",
        ],
      },
      {
        id: "rights",
        heading: "Your choices",
        paragraphs: [
          "You can ask for a copy of the personal data held about you, ask for corrections, or ask for deletion where the law allows and where no record-keeping obligation requires us to keep it. Use the contact page to make a request.",
          "PLACEHOLDER — name the data controller, its address and the supervisory authority that applies.",
        ],
      },
    ],
  },

  terms: {
    slug: "terms",
    eyebrow: "Legal",
    title: "Terms of sale",
    intro:
      "These terms cover purchases made through the AB Tech store. They are a launch draft and require review before they are treated as final.",
    updated: UPDATED,
    notice: DRAFT,
    sections: [
      {
        id: "operator",
        heading: "Who you are buying from",
        paragraphs: [
          "PLACEHOLDER — legal entity name, registration number and registered address of the store operator.",
        ],
      },
      {
        id: "orders",
        heading: "Orders and acceptance",
        bullets: [
          "An order is an offer to buy. It is accepted when the store confirms it, not when the checkout page is submitted.",
          "Product descriptions, specifications and availability come from our catalogue records and can change; an obvious pricing or description error can be corrected before dispatch, and you may then cancel.",
          "Prices are shown in the currency stated at checkout and include or exclude tax as stated there.",
        ],
      },
      {
        id: "payment",
        heading: "Payment",
        paragraphs: [
          "PLACEHOLDER — accepted payment methods and the payment provider, once confirmed.",
          "No card details are stored by the store itself.",
        ],
      },
      {
        id: "liability",
        heading: "Liability and law",
        paragraphs: [
          "Nothing in these terms limits rights you have under mandatory consumer law. PLACEHOLDER — governing law and the courts that apply.",
        ],
      },
      {
        id: "changes",
        heading: "Changes to these terms",
        paragraphs: [
          "The version in force for a purchase is the version published when the order was placed. The date at the top of this page records the last revision.",
        ],
      },
    ],
  },

  faq: {
    slug: "faq",
    eyebrow: "Help",
    title: "Frequently asked questions",
    intro:
      "Short answers to the questions that come up most often about ordering, delivery, prices and returns.",
    updated: UPDATED,
    notice: DRAFT,
    sections: [
      {
        id: "prices",
        heading: "Why does a product say the price requires confirmation?",
        paragraphs: [
          "We only publish a price when we can tie it to a source for that exact model. When we cannot, the product page says so instead of showing an estimate. Request a quote and we will confirm the price and availability before you commit.",
        ],
      },
      {
        id: "wholesale",
        heading: "Do you sell wholesale?",
        paragraphs: [
          "Trade quantities are quoted per request, separately from the retail prices in the catalogue. Send your list through the contact page. A quotation is not an order and does not imply a distribution agreement with any manufacturer.",
        ],
      },
      {
        id: "stock",
        heading: "Is everything in stock?",
        paragraphs: [
          "Stock status reflects the catalogue record at the time you view it. If an item cannot be supplied after you order, we contact you with the options before charging or dispatching anything.",
        ],
      },
      {
        id: "account",
        heading: "Do I need an account to order?",
        paragraphs: [
          "No. Guest checkout is available. An account is useful if you want your orders listed in one place.",
        ],
      },
      {
        id: "tracking",
        heading: "How do I track an order?",
        paragraphs: [
          "Use the order reference from your confirmation on the order page, or open your account if you checked out signed in.",
        ],
      },
      {
        id: "warranty",
        heading: "What warranty comes with a product?",
        paragraphs: [
          "Warranty cover is the manufacturer's for that model; the terms are published by the manufacturer and are not altered by AB Tech. PLACEHOLDER — confirm how warranty claims are handled locally before launch.",
        ],
      },
      {
        id: "returns",
        heading: "Can I return an item?",
        paragraphs: [
          "Yes, within the conditions on the returns page. Your statutory rights are not affected.",
        ],
      },
    ],
  },
};

export const CONTENT_PAGE_SLUGS = Object.keys(CONTENT_PAGES);

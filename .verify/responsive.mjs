import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const VIEWPORTS = (process.env.VIEWPORTS ?? "320,375,390,430,768,1024,1440")
  .split(",")
  .map(Number);
const ROUTES = (
  process.env.ROUTES ??
  "/,/shop,/product/macbook-pro-16-m2-gray,/cart,/checkout,/account,/wishlist,/compare"
).split(",");
const SKIP_INTERACTIONS = process.env.SKIP_INTERACTIONS === "1";
const SCREENSHOT_ROUTES = new Set(["/", "/shop", "/cart", "/checkout"]);
const problems = [];
mkdirSync("artifacts", { recursive: true });

const browser = await chromium.launch();

for (const width of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width, height: width <= 760 ? 780 : 900 },
    isMobile: width <= 760,
    hasTouch: width <= 760,
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(350);

    const result = await page.evaluate(() => {
      const doc = document.documentElement;
      const visual = window.visualViewport ? window.visualViewport.width : window.innerWidth;
      const scale = window.visualViewport ? window.visualViewport.scale : 1;
      const limit = Math.min(doc.clientWidth, visual);
      const overflowBy = doc.scrollWidth - limit;
      const bottomNav = document.querySelector(".bottom-nav");
      const mainNav = document.querySelector(".main-nav");
      const bodyPad = parseFloat(getComputedStyle(document.body).paddingBottom) || 0;
      const offenders = [];
      if (overflowBy > 1) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width > 40 && r.right > limit + 1) {
            offenders.push(
              `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 46)} right=${Math.round(r.right)}`
            );
            if (offenders.length >= 5) break;
          }
        }
      }
      const covers = [];
      return {
        overflowBy,
        scale,
        offenders,
        bottomNavVisible: bottomNav ? getComputedStyle(bottomNav).display !== "none" : false,
        mainNavVisible: mainNav ? getComputedStyle(mainNav).display !== "none" : false,
        bodyPad,
        covers,
        title: document.title
      };
    });

    const expectBottomNav = width <= 760;
    if (result.overflowBy > 1)
      problems.push(`[${width}px ${route}] horizontal overflow ${result.overflowBy}px :: ${result.offenders.join(" | ")}`);
    if (result.scale < 0.995)
      problems.push(`[${width}px ${route}] browser shrank the page to fit (scale=${result.scale.toFixed(2)}) - content is wider than the viewport`);
    if (result.bottomNavVisible !== expectBottomNav)
      problems.push(`[${width}px ${route}] bottom nav visible=${result.bottomNavVisible}, expected ${expectBottomNav}`);
    if (result.mainNavVisible === expectBottomNav)
      problems.push(`[${width}px ${route}] desktop nav visible=${result.mainNavVisible}, expected ${!expectBottomNav} (duplicate navigation)`);
    if (expectBottomNav && result.bodyPad < 50)
      problems.push(`[${width}px ${route}] body padding-bottom ${result.bodyPad}px leaves content under the bottom nav`);

    // after scrolling to the very end of the page, no control may sit under the bottom bar
    if (expectBottomNav) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(250);
      const covers = await page.evaluate(() => {
        const nav = document.querySelector(".bottom-nav");
        if (!nav || getComputedStyle(nav).display === "none") return [];
        const navRect = nav.getBoundingClientRect();
        const visible = el => {
          let n = el;
          while (n && n !== document.body) {
            const s = getComputedStyle(n);
            if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
            n = n.parentElement;
          }
          return true;
        };
        const hits = [];
        for (const el of document.querySelectorAll("button, a, input, select")) {
          if (nav.contains(el) || !visible(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.bottom > navRect.top + 1 && r.top < navRect.bottom - 1) {
            hits.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)}`);
            if (hits.length >= 5) break;
          }
        }
        return hits;
      });
      await page.evaluate(() => window.scrollTo(0, 0));
      if (covers.length)
        problems.push(`[${width}px ${route}] controls left under the bottom nav at page end :: ${covers.join(", ")}`);
    }

    if (SCREENSHOT_ROUTES.has(route) && [320, 390, 768, 1440].includes(width)) {
      const name = `${route === "/" ? "home" : route.replace(/\//g, "-")}-${width}.png`;
      await page.screenshot({ path: `artifacts/${name}`, fullPage: false });
    }
  }
  await ctx.close();
}

/* ---------------- interaction checks ---------------- */
if (SKIP_INTERACTIONS) {
  await browser.close();
  if (problems.length) {
    console.log("PROBLEMS:");
    for (const p of problems) console.log(" - " + p);
    process.exitCode = 1;
  } else {
    console.log("ALL RESPONSIVE CHECKS PASSED");
  }
  process.exit(process.exitCode ?? 0);
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();

// search with suggestions
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.click(".mobile-search-button");
await page.waitForSelector(".search-field input", { state: "visible", timeout: 8000 });
await page.fill(".search-field input", "iphone");
await page.waitForTimeout(300);
const suggestions = await page.locator(".search-suggestion").count();
if (suggestions < 1) problems.push("[390 interaction] search suggestions did not appear");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
if (!page.url().includes("/shop?q=iphone"))
  problems.push(`[390 interaction] search Enter did not navigate to results (url=${page.url()})`);

// add to cart from a product card, badge must update
await page.goto(BASE + "/shop", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.locator(".quick-add").first().click();
await page.waitForTimeout(300);
const badge = await page.locator(".bottom-nav .nav-icon i").first().textContent();
if (!badge || badge.trim() !== "1")
  problems.push(`[390 interaction] bottom-nav cart badge is "${badge}", expected 1`);

// cart page reflects state and quantity control works
await page.goto(BASE + "/cart", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const lines = await page.locator(".cart-line").count();
if (lines < 1) problems.push("[390 interaction] cart line missing after add to cart");
await page.locator(".cart-qty button").last().click();
await page.waitForTimeout(200);
const qty = await page.locator(".cart-qty span").first().textContent();
if (qty?.trim() !== "2") problems.push(`[390 interaction] cart quantity is "${qty}", expected 2`);

// bottom navigation menu sheet opens and navigates
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
await page.click('.bottom-nav button[aria-controls="mobile-menu"]');
await page.waitForTimeout(400);
const sheetOpen = await page.locator(".menu-layer.is-open").count();
if (sheetOpen !== 1) problems.push("[390 interaction] category sheet did not open");
await page.locator('.menu-cats a[href="/shop?category=laptops"]').click();
await page.waitForTimeout(600);
if (!page.url().includes("category=laptops"))
  problems.push(`[390 interaction] sheet category link did not navigate (url=${page.url()})`);

// sticky add to cart on the product page
await page.goto(BASE + "/product/macbook-pro-16-m2-gray", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const pdPosition = await page.locator(".pd-buy").evaluate(el => getComputedStyle(el).position);if (pdPosition === "sticky")
  problems.push(`[390 interaction] inline .pd-buy is ${pdPosition}; it must stay in normal flow`);

// the fixed buy bar must appear only after the inline row scrolls away,
// and must never sit on top of the bottom navigation
const bothVisible = await page.evaluate(() => {
  const bar = document.querySelector(".mobile-buy-bar");
  const buy = document.querySelector(".pd-buy");
  if (!bar || !buy) return false;
  const r = buy.getBoundingClientRect();
  return r.top < window.innerHeight && r.bottom > 0;
});
if (bothVisible)
  problems.push("[390 interaction] fixed buy bar is shown while the inline add-to-cart row is visible");
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(700);
const barAfter = await page.locator(".mobile-buy-bar").count();
if (barAfter !== 1)
  problems.push(`[390 interaction] buy bar missing after scrolling (count=${barAfter})`);
const barOverlap = await page.evaluate(() => {
  const bar = document.querySelector(".mobile-buy-bar");
  const nav = document.querySelector(".bottom-nav");
  if (!bar || !nav) return false;
  return bar.getBoundingClientRect().bottom > nav.getBoundingClientRect().top + 1;
});
if (barOverlap) problems.push("[390 interaction] fixed buy bar overlaps the bottom navigation");
await page.locator(".mobile-buy-bar .pd-add").click();
await page.waitForTimeout(400);
const badgeAfterBar = await page.locator(".bottom-nav .nav-icon i").first().textContent();
if (!badgeAfterBar || Number(badgeAfterBar) < 3)
  problems.push(`[390 interaction] cart badge after sticky-bar add is "${badgeAfterBar}"`);
await page.screenshot({ path: "artifacts/product-390-bar.png" });
await page.screenshot({ path: "artifacts/product-390.png" });

// desktop: bottom nav hidden, main nav shown
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const dpage = await desktop.newPage();
await dpage.goto(BASE + "/product/macbook-pro-16-m2-gray", { waitUntil: "domcontentloaded" });
await dpage.waitForTimeout(400);
await dpage.screenshot({ path: "artifacts/product-1440.png" });
await dpage.goto(BASE + "/checkout", { waitUntil: "domcontentloaded" });
await dpage.waitForTimeout(400);
await dpage.screenshot({ path: "artifacts/checkout-1440.png" });

await browser.close();

if (problems.length) {
  console.log("PROBLEMS:");
  for (const p of problems) console.log(" - " + p);
  process.exitCode = 1;
} else {
  console.log("ALL RESPONSIVE CHECKS PASSED");
}

import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://127.0.0.1:3000";
const ROUTES = ["/", "/shop", "/product/macbook-pro-16-m2-gray", "/cart"];
const problems = [];

const browser = await chromium.launch();

for (const width of [390, 1440]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();

  const remote = [];
  page.on("request", req => {
    if (!req.url().startsWith(BASE) && /\.(webp|svg|png|jpe?g|gif)(\?|$)/i.test(req.url())) {
      remote.push(req.url());
    }
  });
  const consoleErrors = [];
  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
    // give lazy images a chance, then scroll through the page
    await page.evaluate(async () => {
      const step = 900;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(2500);

    const stats = await page.evaluate(() => {
      const imgs = [...document.images];
      const broken = imgs
        .filter(img => img.complete && img.naturalWidth === 0)
        .map(img => img.getAttribute("src"));
      const pending = imgs.filter(img => !img.complete).length;
      const local = imgs.filter(img => (img.getAttribute("src") || "").startsWith("/images/")).length;
      return { total: imgs.length, local, broken, pending };
    });

    if (stats.broken.length)
      problems.push(`[${width}px ${route}] ${stats.broken.length}/${stats.total} images failed: ${stats.broken.slice(0, 4).join(", ")}`);
    if (stats.local === 0)
      problems.push(`[${width}px ${route}] no local /images/ references found`);
    console.log(`${width}px ${route} -> ${stats.total} images, ${stats.local} local, ${stats.broken.length} broken, ${stats.pending} still loading`);
  }

  if (remote.length) problems.push(`[${width}px] requests left the site: ${[...new Set(remote)].slice(0, 5).join(", ")}`);
  const realErrors = consoleErrors.filter(e => !/favicon/i.test(e));
  if (realErrors.length) problems.push(`[${width}px] console errors: ${realErrors.slice(0, 3).join(" | ")}`);

  await page.screenshot({ path: `artifacts/local-assets-${width}.png` });
  await ctx.close();
}

await browser.close();

if (problems.length) {
  console.log("PROBLEMS:");
  for (const p of problems) console.log(" - " + p);
  process.exitCode = 1;
} else {
  console.log("ALL IMAGES LOAD LOCALLY");
}

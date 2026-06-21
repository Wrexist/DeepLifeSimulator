const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(__dirname, 'death-popup-preview.html'));
  await page.waitForTimeout(300);

  for (const id of ['summary', 'legacy']) {
    const el = await page.$('#' + id);
    await el.screenshot({ path: path.join(__dirname, `death-popup-${id}.png`) });
    console.log('wrote death-popup-' + id + '.png');
  }
  await browser.close();
})();

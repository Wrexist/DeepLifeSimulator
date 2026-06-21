const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(__dirname, 'death-popup-preview.html'));
  // Expand the summary card so all sections are visible at once (no inner scroll).
  await page.evaluate(() => {
    const p = document.querySelector('#summary');
    p.style.height = 'auto';
    p.querySelector('.screen').style.height = 'auto';
    const card = p.querySelector('.card');
    card.style.maxHeight = 'none';
    p.querySelector('.body').style.overflow = 'visible';
  });
  await page.waitForTimeout(200);
  const el = await page.$('#summary');
  await el.screenshot({ path: path.join(__dirname, 'death-popup-summary-full.png') });
  console.log('wrote death-popup-summary-full.png');
  await browser.close();
})();

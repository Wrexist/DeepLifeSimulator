import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const SCREENSHOTS_DIR = join(import.meta.dirname, '..', 'screenshots');
const APP_URL = 'http://localhost:8081';
const PHONE_WIDTH = 430;
const PHONE_HEIGHT = 932;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForText(page, text, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const found = await page.evaluate((t) => {
      return document.body?.innerText?.includes(t);
    }, text);
    if (found) return true;
    await sleep(500);
  }
  return false;
}

async function takeScreenshot(page, name, index) {
  const path = join(SCREENSHOTS_DIR, `${index}-${name}.png`);
  await page.screenshot({ path, type: 'png' });
  console.log(`  ✓ Saved: ${path}`);
  return path;
}

async function clickText(page, text) {
  const clicked = await page.evaluate((t) => {
    const els = document.querySelectorAll('[role], div, span, button, a');
    for (const el of els) {
      if (el.textContent?.trim() === t || el.textContent?.includes(t)) {
        el.click();
        return true;
      }
    }
    return false;
  }, text);
  if (clicked) {
    console.log(`  → Clicked: "${text}"`);
    await sleep(2000);
  } else {
    console.log(`  ✗ Could not find: "${text}"`);
  }
  return clicked;
}

async function findAndClick(page, partialText) {
  const clicked = await page.evaluate((t) => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.includes(t)) {
        let el = walker.currentNode.parentElement;
        while (el && el.tagName !== 'BODY') {
          if (el.onclick || el.getAttribute('role') === 'button' ||
              el.style?.cursor === 'pointer' || el.tagName === 'BUTTON') {
            el.click();
            return true;
          }
          el = el.parentElement;
        }
        // Click the text node's parent anyway
        walker.currentNode.parentElement?.click();
        return true;
      }
    }
    return false;
  }, partialText);
  if (clicked) {
    console.log(`  → Clicked: "${partialText}"`);
    await sleep(2000);
  }
  return clicked;
}

async function getPageText(page) {
  return await page.evaluate(() => document.body?.innerText?.substring(0, 2000) || '');
}

async function main() {
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${PHONE_WIDTH},${PHONE_HEIGHT}`,
      '--disable-web-security',
      '--no-sandbox',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: PHONE_WIDTH, height: PHONE_HEIGHT, deviceScaleFactor: 2 });

  console.log(`Navigating to ${APP_URL}...`);
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 30000 });
  await sleep(3000);

  let pageText = await getPageText(page);
  console.log('Page loaded. Content preview:', pageText.substring(0, 200));

  // Check if we're at main menu
  if (pageText.includes('New Game') || pageText.includes('Continue')) {
    console.log('\n=== At Main Menu ===');

    // Try Continue first, fall back to New Game
    if (pageText.includes('Continue')) {
      await findAndClick(page, 'Continue');
    } else {
      await findAndClick(page, 'New Game');
    }
    await sleep(3000);
  }

  // Check for onboarding screens and skip through them
  pageText = await getPageText(page);
  console.log('After click, page text:', pageText.substring(0, 300));

  // If we hit a customize or perks screen, try to skip/proceed
  for (let attempt = 0; attempt < 5; attempt++) {
    pageText = await getPageText(page);
    if (pageText.includes('Start') && !pageText.includes('Start a new')) {
      await findAndClick(page, 'Start');
      await sleep(2000);
    } else if (pageText.includes('Next')) {
      await findAndClick(page, 'Next');
      await sleep(2000);
    } else if (pageText.includes('Skip')) {
      await findAndClick(page, 'Skip');
      await sleep(2000);
    } else if (pageText.includes('Continue') && !pageText.includes('New Game')) {
      await findAndClick(page, 'Continue');
      await sleep(2000);
    } else {
      break;
    }
  }

  await sleep(2000);
  pageText = await getPageText(page);
  console.log('\nCurrent page:', pageText.substring(0, 400));

  // Now we should be in the game. Take Screenshot 1: Home/Life tab
  console.log('\n=== Screenshot 1: Hero Shot (Home Tab) ===');
  await sleep(1000);
  await takeScreenshot(page, 'hero-home', 1);

  // Screenshot 2: Navigate to Phone tab → Dating/Tinder
  console.log('\n=== Screenshot 2: Dating ===');
  // Try clicking Phone tab
  const tabClicked = await findAndClick(page, 'Phone');
  if (!tabClicked) await findAndClick(page, '📱');
  await sleep(2000);
  // Try to open Tinder/Dating app
  const datingClicked = await findAndClick(page, 'Dating') || await findAndClick(page, 'Tinder');
  await sleep(2000);
  await takeScreenshot(page, 'dating', 2);

  // Go back if needed
  await page.goBack();
  await sleep(2000);

  // Screenshot 3: We'll skip death for now (hard to trigger)
  // Instead get the Progression tab for legacy/family content
  console.log('\n=== Screenshot 3: Progression Tab ===');
  await findAndClick(page, 'Progress');
  if (!await waitForText(page, 'Progress', 3000)) {
    await findAndClick(page, '📈');
  }
  await sleep(2000);
  await takeScreenshot(page, 'progression', 3);

  // Screenshot 4: PC tab → Bitcoin Mining
  console.log('\n=== Screenshot 4: Bitcoin Mining ===');
  await findAndClick(page, 'PC');
  if (!await waitForText(page, 'Bitcoin', 3000)) {
    await findAndClick(page, '💻');
  }
  await sleep(2000);
  await findAndClick(page, 'Bitcoin');
  await sleep(2000);
  await takeScreenshot(page, 'bitcoin-mining', 4);

  // Screenshot 5: Phone → Social Media
  console.log('\n=== Screenshot 5: Social Media ===');
  await page.goBack();
  await sleep(1000);
  await findAndClick(page, 'Phone');
  await sleep(2000);
  await findAndClick(page, 'Social');
  await sleep(2000);
  await takeScreenshot(page, 'social-media', 5);

  // Screenshot 6: Work tab
  console.log('\n=== Screenshot 6: Work Tab ===');
  await page.goBack();
  await sleep(1000);
  await findAndClick(page, 'Work');
  await sleep(2000);
  await takeScreenshot(page, 'work', 6);

  // Screenshot 7: Health tab
  console.log('\n=== Screenshot 7: Health Tab ===');
  await findAndClick(page, 'Health');
  await sleep(2000);
  await takeScreenshot(page, 'health', 7);

  // Screenshot 8: Market tab
  console.log('\n=== Screenshot 8: Market Tab ===');
  await findAndClick(page, 'Market');
  await sleep(2000);
  await takeScreenshot(page, 'market', 8);

  console.log('\n=== Done! ===');
  console.log(`Screenshots saved to: ${SCREENSHOTS_DIR}`);

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

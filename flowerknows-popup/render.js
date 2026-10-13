// cards.html의 7장(#c1~#c7)을 out/ 폴더에 1080x1350 PNG로 저장한다.
// 사용법: npm i -D playwright && npx playwright install chromium && node render.js
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const dir = __dirname;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1500 } });
  await page.goto('file://' + path.join(dir, 'cards.html'));
  await page.evaluate(() => document.fonts.ready);
  for (let i = 1; i <= 7; i++) {
    const el = await page.$('#c' + i);
    await el.screenshot({ path: path.join(dir, 'out', `FN_seongsu_popup_0${i}.png`) });
    console.log('saved card', i);
  }
  await browser.close();
})();

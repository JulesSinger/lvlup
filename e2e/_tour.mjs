import { chromium } from 'playwright';
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
for (const id of ['taches', 'calendrier', 'budget', 'courses', 'objectifs', 'recettes']) {
  for (const [name, vp] of [['desk', { width: 1200, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const p = await browser.newPage({ viewport: vp });
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    await p.goto(`http://localhost:4296/?demo=${id}#/${id}`);
    await p.waitForSelector('.atlas-tour', { timeout: 15000 });
    const missing = [];
    for (let i = 1; ; i++) {
      await p.waitForTimeout(i === 1 ? 1500 : 900);
      if (i === 2 && name === 'desk') await p.screenshot({ path: `${out}/tour-${id}.png` });
      if (await p.locator('.atlas-tour[data-target-missing]').count()) missing.push(i);
      const next = p.getByRole('button', { name: 'Suivant ›' });
      if (!(await next.count())) break;
      await next.click();
    }
    console.log(id, name, 'missing steps:', JSON.stringify(missing), 'errors:', errors.length ? errors : 'none');
    await p.close();
  }
}
await browser.close();

import { chromium } from 'playwright';

async function findStartButtonInstance() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
  });
  await context.addInitScript(() => {
    // @ts-ignore
    window.__name = (fn: any) => fn;
  });
  await context.addCookies([
    {
      name: 'ATERNOS_SESSION',
      value: process.env.ATERNOS_SESSION || '',
      domain: '.aternos.org',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: 'ATERNOS_SERVER',
      value: process.env.ATERNOS_SERVER || '',
      domain: '.aternos.org',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  await page.goto('https://aternos.org/server/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(`
    (() => {
      // Find all event listeners or triggers
      const startEl = document.querySelector('#start');
      // Set the anti-adblock integrity check
      window['IAWQydGfuKOvkaVw'] = '{=n0s?P,fNCTu-x+C*O/H%PJ\\\\KmtAV';

      // Let's inspect all event listeners on #start
      let clickFired = false;
      if (startEl) {
        startEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        startEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        startEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        clickFired = true;
      }

      return {
        clickFired,
        classes: startEl ? startEl.className : null,
      };
    })()
  `);

  console.log('DISPATCH EVENT RESULT:', res);

  // Monitor status for 10 seconds
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    const s = await page.evaluate(`
      (() => {
        const status = document.querySelector('.statuslabel-label')?.textContent?.trim();
        const startClass = document.querySelector('#start')?.className;
        const alerts = Array.from(document.querySelectorAll('.alert, .modal, .btn-clickme, #confirm')).map(a => a.className + ': ' + a.textContent?.trim());
        return { status, startClass, alerts };
      })()
    `);
    console.log(`[${i + 1}s]`, JSON.stringify(s));
  }

  await browser.close();
}

findStartButtonInstance().catch(console.error);

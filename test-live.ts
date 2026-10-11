import { chromium } from 'playwright';

async function checkNetwork() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
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

  page.on('request', req => {
    if (req.url().includes('aternos') && !req.url().includes('.css') && !req.url().includes('.png')) {
      console.log('REQ:', req.method(), req.url());
    }
  });

  page.on('response', async res => {
    if (res.url().includes('ajax') || res.url().includes('start') || res.url().includes('queue') || res.url().includes('panel')) {
      try {
        const text = await res.text();
        console.log('RES:', res.status(), res.url(), text.substring(0, 150));
      } catch {}
    }
  });

  await page.goto('https://aternos.org/server/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Clicking start...');
  await page.evaluate(() => {
    const s = document.querySelector('#start') as HTMLElement;
    if (s) s.click();
  });

  await page.waitForTimeout(2000);

  // Check what the modal has and click its button
  const modalInfo = await page.evaluate(() => {
    const modal = document.querySelector('.alert, .modal, .alert-body, [class*=\"alert\"]');
    const btns = Array.from(document.querySelectorAll('.alert-buttons .btn, .alert .btn, button.btn-success')).map(b => ({
      class: b.className,
      text: b.textContent?.trim(),
      id: b.id,
      disabled: (b as HTMLButtonElement).disabled,
      onclick: b.getAttribute('onclick'),
    }));
    return {
      modalText: modal ? modal.textContent?.trim().replace(/\\s+/g, ' ') : null,
      buttons: btns,
    };
  });
  console.log('Modal info:', JSON.stringify(modalInfo, null, 2));

  // Try clicking modal button
  await page.evaluate(() => {
    const btn = document.querySelector('.alert-buttons .btn-success, .alert .btn-success') as HTMLElement;
    if (btn) {
      console.log('Clicking alert-buttons btn-success');
      btn.click();
    }
  });

  await page.waitForTimeout(3000);
  await browser.close();
}

checkNetwork().catch(console.error);

const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('requestfailed', request => {
    console.log('FAILED URL:', request.url(), request.failure().errorText);
  });
  
  page.on('response', response => {
    if (!response.ok()) {
      console.log('404 URL:', response.url(), response.status());
    }
  });

  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle0' });
  await browser.close();
})();

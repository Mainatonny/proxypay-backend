import puppeteer from 'puppeteer';

const RECHARGE_USERNAME = process.env.RECHARGE_USERNAME || '13231579635';
const RECHARGE_PASSWORD = process.env.RECHARGE_PASSWORD || '579635';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://m.1jianji.com/#/pages/login/index', {
    waitUntil: 'networkidle2', // wait for Vue app JS to load
    timeout: 60000
  });

  // DEBUG: take screenshot so we can see what rendered
  await page.screenshot({ path: 'login-page.png', fullPage: true });

  // Try different selectors: mobile input is usually an <input type="text"> under a form
  await page.waitForSelector('input[type="text"]', { timeout: 60000 });
  await page.type('input[type="text"]', RECHARGE_USERNAME, { delay: 100 });

  await page.waitForSelector('input[type="password"]', { timeout: 60000 });
  await page.type('input[type="password"]', RECHARGE_PASSWORD, { delay: 100 });

  // Login button may be <button> or <view>
  const [loginButton] = await page.$x('//button[contains(text(), "登录")]');
  if (loginButton) {
    await loginButton.click();
  } else {
    console.log('⚠️ Login button not found by XPath, try inspecting screenshot.');
  }

  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'after-login.png', fullPage: true });

  console.log('✅ Login attempted, screenshots saved.');
  await browser.close();
})();


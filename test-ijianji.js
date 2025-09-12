import puppeteer from 'puppeteer';

const RECHARGE_USERNAME = process.env.RECHARGE_USERNAME || '13231579635';
const RECHARGE_PASSWORD = process.env.RECHARGE_PASSWORD || '579635';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true
    });
  const page = await browser.newPage();

  // Use domcontentloaded instead of waiting for full network idle
  await page.goto('https://m.1jianji.com/#/pages/login/index', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Wait for phone input
  await page.waitForSelector('input[placeholder="请输入手机号"]', { timeout: 60000 });
  await page.type('input[placeholder="请输入手机号"]', RECHARGE_USERNAME, { delay: 100 });
  await page.type('input[placeholder="请输入密码"]', RECHARGE_PASSWORD, { delay: 100 });

  const [loginButton] = await page.$x('//button[contains(text(), "登录")]');
  if (loginButton) await loginButton.click();

  // Wait for post-login element or just a fixed delay
  await page.waitForTimeout(5000);

  console.log('Login attempted');
})();

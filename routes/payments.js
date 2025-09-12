const express = require('express');
const pool = require('../config/database');
const puppeteer = require('puppeteer');
require('dotenv').config();

const router = express.Router();

// Constants for the recharge website
const RECHARGE_URL = 'https://m.1jianji.com/#/pages/login/index';
const RECHARGE_USERNAME = process.env.RECHARGE_USERNAME || '13231579635';
const RECHARGE_PASSWORD = process.env.RECHARGE_PASSWORD || '579635';

// Create payment order
router.post('/create-order', async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount) {
            return res.status(400).json({ error: 'Amount is required' });
        }

        // Create order in DB
        const orderResult = await pool.query(
            `INSERT INTO orders (amount, payment_method, status) 
             VALUES ($1, 'alipay', 'pending') RETURNING *`,
            [amount]
        );
        const order = orderResult.rows[0];

        try {
            const browser = await puppeteer.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();

            await page.goto(RECHARGE_URL, { waitUntil: 'networkidle2' });

            // Wait for login form
            await page.waitForSelector('input[placeholder="请输入手机号"]', { timeout: 10000 });
            await page.type('input[placeholder="请输入手机号"]', RECHARGE_USERNAME, { delay: 100 });
            await page.type('input[placeholder="请输入密码"]', RECHARGE_PASSWORD, { delay: 100 });

            // Click login button
            const [loginButton] = await page.$x('//button[contains(text(), "登录")]');
            if (!loginButton) throw new Error('Login button not found');
            await loginButton.click();

            // Wait for navigation after login (adjust if needed)
            await page.waitForTimeout(5000);

            // Navigate to recharge page
            // NOTE: You might need to adjust the selector for the recharge button/input
            await page.goto(`https://m.1jianji.com/#/pages/recharge/index?amount=${amount}`, { waitUntil: 'networkidle2' });

            // Click "Alipay" payment option (adjust selector)
            const [alipayBtn] = await page.$x('//button[contains(text(), "Alipay")] | //button[contains(text(), "支付宝")]');
            if (alipayBtn) await alipayBtn.click();

            // Wait for Alipay URL to appear
            await page.waitForTimeout(3000); // wait for the redirect/link
            const alipayUrl = await page.evaluate(() => {
                const link = document.querySelector('a')?.href;
                return link || '';
            });

            if (!alipayUrl) throw new Error('Failed to extract Alipay URL');

            // Update order with Alipay URL
            await pool.query('UPDATE orders SET payment_url = $1 WHERE id = $2', [alipayUrl, order.id]);

            await browser.close();

            res.status(201).json({
                success: true,
                order_id: order.id,
                alipay_url: alipayUrl
            });

        } catch (err) {
            console.error('Recharge process error:', err);
            await pool.query('UPDATE orders SET status = $1 WHERE id = $2', ['failed', order.id]);
            res.status(500).json({ error: 'Failed to generate payment URL', details: err.message });
        }

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get order status
router.get('/order-status/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const orderResult = await pool.query(
            `SELECT * FROM orders WHERE id = $1`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        res.json({ order: orderResult.rows[0] });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
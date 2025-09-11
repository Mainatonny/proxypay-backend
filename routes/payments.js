const express = require('express');
const pool = require('../config/database');
const axios = require('axios');
const cheerio = require('cheerio');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
require('dotenv').config();

const router = express.Router();

// Constants for the recharge website
const RECHARGE_BASE_URL = 'https://www.ijianji.com';
const RECHARGE_USERNAME = process.env.RECHARGE_USERNAME || '13231579635';
const RECHARGE_PASSWORD = process.env.RECHARGE_PASSWORD || '579635';

// Common headers (mimic Firefox + Bing referer)
const COMMON_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Referer': 'https://www.bing.com/',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Priority': 'u=0, i',
    'Content-Type': 'application/x-www-form-urlencoded'
};

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

        // Log in to recharge website and get Alipay URL
        const jar = new tough.CookieJar();
        const client = wrapper(axios.create({ 
            jar,
            withCredentials: true 
        }));

        try {
            // Step 1: Login
            const loginResponse = await client.post(
                `${RECHARGE_BASE_URL}/login`,
                new URLSearchParams({ 
                    username: RECHARGE_USERNAME, 
                    password: RECHARGE_PASSWORD 
                }),
                { headers: COMMON_HEADERS }
            );

            if (loginResponse.status !== 200) {
                throw new Error(`Login failed with status ${loginResponse.status}`);
            }

            // Step 2: Perform recharge and get payment URL
            const rechargeResponse = await client.post(
                `${RECHARGE_BASE_URL}/recharge`,
                new URLSearchParams({ 
                    amount: amount,
                    payment_method: 'alipay'
                }),
                { headers: COMMON_HEADERS }
            );

            // Parse the response to extract Alipay URL
            const $ = cheerio.load(rechargeResponse.data);
            let alipayUrl = '';
            
            // Try to find Alipay URL in links
            $('a').each((i, elem) => {
                const href = $(elem).attr('href');
                if (href && href.includes('alipay.com')) {
                    alipayUrl = href;
                    return false; // Break loop
                }
            });

            // Try to find in form actions
            if (!alipayUrl) {
                $('form').each((i, elem) => {
                    const action = $(elem).attr('action');
                    if (action && action.includes('alipay.com')) {
                        alipayUrl = action;
                        return false; 
                    }
                });
            }

            // Try to find in JS snippets
            if (!alipayUrl) {
                const scriptText = $('script').text();
                const match = scriptText.match(/alipay\.com[^'"]*/);
                if (match) {
                    alipayUrl = 'https://' + match[0];
                }
            }

            if (!alipayUrl) {
                throw new Error('Could not extract Alipay URL from recharge page');
            }

            // Update order with Alipay URL
            await pool.query(
                'UPDATE orders SET payment_url = $1 WHERE id = $2',
                [alipayUrl, order.id]
            );

            res.status(201).json({
                success: true,
                order_id: order.id,
                alipay_url: alipayUrl
            });

        } catch (error) {
            console.error('Error during recharge process:', error);
            
            // Update order status to failed
            await pool.query(
                'UPDATE orders SET status = $1 WHERE id = $2',
                ['failed', order.id]
            );
            
            res.status(500).json({ 
                error: 'Failed to generate payment URL',
                details: error.message 
            });
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

        res.json({
            order: orderResult.rows[0]
        });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

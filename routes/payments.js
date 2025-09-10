const path = require('path');
const QRCode = require('qrcode');
const express = require('express');
const app = express();
const pool = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { processPayment } = require('../controllers/paymentController');
const axios = require('axios');
const cheerio = require('cheerio');
const tough = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
require('dotenv').config();

const ALIPAY_BASE_URL = process.env.ALIPAY_BASE_URL || 'http://localhost:4000';
const AWAKEN_USERNAME = process.env.AWAKEN_USERNAME || 'testuser';
const AWAKEN_PASSWORD = process.env.AWAKEN_PASSWORD || 'testpass';


const router = express.Router();

router.use('/images', express.static(path.join(__dirname, 'images')));

//const STATIC_ALIPAY_QR = "/images/alipay.jpg";

router.get('/get-recharge-url/:orderId', authenticateToken, async (req, res) => {
    const { orderId } = req.params;

    try {
        const orderResult = await pool.query(
            `SELECT * FROM orders WHERE id = $1`,
            [orderId]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orderResult.rows[0];

        if (!String(order.payment_method).toLowerCase().includes('alipay')) {
            return res.status(400).json({ error: 'Recharge URL only available for Alipay' });
        }

        const jar = new tough.CookieJar();
        const client = wrapper(axios.create({ jar }));

        // Simulate login
        await client.post(
            `${ALIPAY_BASE_URL}/login`,
            new URLSearchParams({
                username: AWAKEN_USERNAME,
                password: AWAKEN_PASSWORD
            }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        // Fetch recharge page
        const rechargePage = await client.get(
            `${ALIPAY_BASE_URL}/recharge?amount=${order.amount}&order_id=${order.id}`
        );

        // Extract recharge URL
        const $ = cheerio.load(rechargePage.data);
        const rechargeURL = $('#recharge-link').attr('href');

        res.json({
            order,
            recharge_url: rechargeURL || STATIC_ALIPAY_QR
        });
    } catch (error) {
        console.error('Error getting recharge URL:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get payment methods
router.get('/methods', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM payment_methods WHERE is_active = true ORDER BY name'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/create-order', authenticateToken, async (req, res) => {
    try {
        const { amount, payment_method, user_id } = req.body;

        if (!amount || !payment_method) {
            return res.status(400).json({ error: 'Amount and payment method are required' });
        }

        // 1️⃣ Create order in DB
        const orderResult = await pool.query(
            `INSERT INTO orders (user_id, amount, payment_method, status) 
             VALUES ($1, $2, $3, 'pending') RETURNING *`,
            [user_id, amount, payment_method]
        );
        const order = orderResult.rows[0];

        // 2️⃣ Fetch payment method name
        const methodResult = await pool.query(
            'SELECT name FROM payment_methods WHERE id = $1',
            [payment_method]
        );
        const methodName = methodResult.rows[0]?.name || '';

        let paymentQR = '';

        // 3️⃣ Only generate dynamic QR for Alipay
        if (methodName.toLowerCase().includes('alipay')) {
            try {
                const jar = new tough.CookieJar();
                const client = wrapper(axios.create({ jar }));

                await client.post(
                    `${ALIPAY_BASE_URL}/login`,
                    new URLSearchParams({ username: AWAKEN_USERNAME, password: AWAKEN_PASSWORD }),
                    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
                );

                // Recharge page URL
                paymentQR = `${ALIPAY_BASE_URL}/pay/${order.id}?amount=${amount}`;
            } catch (err) {
                console.error('Failed to fetch dynamic Alipay URL:', err.message);
                return res.status(500).json({ error: 'Failed to generate Alipay recharge URL' });
            }
        }

        res.status(201).json({
            message: 'Order created successfully',
            order,
            payment_qr: paymentQR
        });

    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Simulate QR scan and “payment”
router.post('/simulate', authenticateToken, async (req, res) => {
    try {
        const { order_id, user_id } = req.body;

        // Validate order
        const orderResult = await pool.query(
            'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
            [order_id, user_id]
        );
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Simulate payment by marking order as success
        await pool.query(
            'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
            ['success', order_id]
        );

        // Redirect back to frontend success page
        res.json({
            success: true,
            message: 'Payment simulated successfully',
            redirect_url: `/payment-success?order_id=${order_id}`
        });
    } catch (err) {
        console.error('Simulation error:', err);
        res.status(500).json({ success: false, error: 'Simulation failed' });
    }
});

// Get order history
router.get('/history/:user_id', authenticateToken, async (req, res) => {
    try {
        const { user_id } = req.params;
        const { limit = 10, offset = 0 } = req.query;

        const result = await pool.query(
            `SELECT o.*, pm.name as payment_method_name 
             FROM orders o 
             LEFT JOIN payment_methods pm ON o.payment_method = pm.id 
             WHERE o.user_id = $1 
             ORDER BY o.created_at DESC 
             LIMIT $2 OFFSET $3`,
            [user_id, limit, offset]
        );

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM orders WHERE user_id = $1',
            [user_id]
        );

        res.json({
            orders: result.rows,
            total: parseInt(countResult.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching order history:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get payment methods
/**router.get('/methods', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payment_methods WHERE is_active = true ORDER BY name'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const STATIC_ALIPAY_QR = "/images/alipay.jpg";

// Create payment order
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { amount, payment_method, user_id } = req.body;

    if (!amount || !payment_method) {
      return res.status(400).json({ error: 'Amount and payment method are required' });
    }

    // Create order in database
    const orderResult = await pool.query(
      `INSERT INTO orders (user_id, amount, payment_method, status) 
       VALUES ($1, $2, $3, 'pending') 
       RETURNING *`,
      [user_id, amount, payment_method]
    );

    const order = orderResult.rows[0];

    // Instead of generating a dynamic QR, just return your static AliPay QR
    res.status(201).json({
      message: 'Order created successfully',
      order,
      payment_qr: STATIC_ALIPAY_QR
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

// Process payment
router.post('/process', authenticateToken, async (req, res) => {
  try {
    const { order_id, payment_details } = req.body;

    if (!order_id) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    // Get order details
    const orderResult = await pool.query(
      'SELECT * FROM orders WHERE id = $1',
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Process payment using the payment controller
    const paymentResult = await processPayment(order, payment_details);

    if (paymentResult.success) {
      // Update order status to success
      await pool.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
        ['success', order_id]
      );

      res.json({
        message: 'Payment processed successfully',
        transaction_id: paymentResult.transaction_id
      });
    } else {
      // Update order status to failed
      await pool.query(
        'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2',
        ['failed', order_id]
      );

      res.status(400).json({
        error: 'Payment processing failed',
        details: paymentResult.error
      });
    }
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user order history
router.get('/history/:user_id', authenticateToken, async (req, res) => {
  try {
    const { user_id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    const result = await pool.query(
      `SELECT o.*, pm.name as payment_method_name 
       FROM orders o 
       LEFT JOIN payment_methods pm ON o.payment_method = pm.id 
       WHERE o.user_id = $1 
       ORDER BY o.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [user_id, limit, offset]
    );

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [user_id]
    );

    res.json({
      orders: result.rows,
      total: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching order history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
**/

module.exports = router;
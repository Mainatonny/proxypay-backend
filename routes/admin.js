const express = require('express');
const pool = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all orders with filters
router.get('/orders', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { status, start_date, end_date, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT o.*, a.username, pm.name as payment_method_name 
      FROM orders o 
      LEFT JOIN accounts a ON o.user_id = a.id 
      LEFT JOIN payment_methods pm ON o.payment_method = pm.id 
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
    }

    if (start_date) {
      paramCount++;
      query += ` AND o.created_at >= $${paramCount}`;
      params.push(start_date);
    }

    if (end_date) {
      paramCount++;
      query += ` AND o.created_at <= $${paramCount}`;
      params.push(end_date);
    }

    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM orders o WHERE 1=1';
    let countParams = [];
    let countParamCount = 0;

    if (status) {
      countParamCount++;
      countQuery += ` AND o.status = $${countParamCount}`;
      countParams.push(status);
    }

    if (start_date) {
      countParamCount++;
      countQuery += ` AND o.created_at >= $${countParamCount}`;
      countParams.push(start_date);
    }

    if (end_date) {
      countParamCount++;
      countQuery += ` AND o.created_at <= $${countParamCount}`;
      countParams.push(end_date);
    }

    const countResult = await pool.query(countQuery, countParams);

    res.json({
      orders: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get dashboard statistics
router.get('/dashboard', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Get total revenue
    const revenueResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total_revenue 
      FROM orders 
      WHERE status = 'success'
    `);

    // Get total orders count
    const ordersResult = await pool.query(`
      SELECT 
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_orders
      FROM orders
    `);

    // Get success rate
    const successRate = ordersResult.rows[0].successful_orders / ordersResult.rows[0].total_orders * 100;

    // Get active accounts count
    const accountsResult = await pool.query(`
      SELECT COUNT(*) as active_accounts 
      FROM proxy_accounts 
      WHERE status = 'active'
    `);

    // Get account performance
    const performanceResult = await pool.query(`
      SELECT 
        pa.username,
        COUNT(o.id) as total_orders,
        COUNT(CASE WHEN o.status = 'success' THEN 1 END) as successful_orders,
        COALESCE(SUM(CASE WHEN o.status = 'success' THEN o.amount ELSE 0 END), 0) as total_amount,
        CASE 
          WHEN COUNT(o.id) = 0 THEN 0
          ELSE COUNT(CASE WHEN o.status = 'success' THEN 1 END) * 100.0 / COUNT(o.id)
        END as success_rate
      FROM proxy_accounts pa
      LEFT JOIN orders o ON pa.id = o.proxy_account_id
      GROUP BY pa.id, pa.username
      ORDER BY total_amount DESC
    `);

    res.json({
      total_revenue: parseFloat(revenueResult.rows[0].total_revenue),
      total_orders: parseInt(ordersResult.rows[0].total_orders),
      successful_orders: parseInt(ordersResult.rows[0].successful_orders),
      success_rate: successRate || 0,
      active_accounts: parseInt(accountsResult.rows[0].active_accounts),
      account_performance: performanceResult.rows
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all proxy accounts
router.get('/proxy-accounts', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM proxy_accounts ORDER BY priority, created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching proxy accounts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update proxy account
router.put('/proxy-accounts/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password, platform, priority, status } = req.body;

    const result = await pool.query(`
      UPDATE proxy_accounts 
      SET username = $1, password = $2, platform = $3, priority = $4, status = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [username, password, platform, priority, status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Proxy account not found' });
    }

    res.json({
      message: 'Proxy account updated successfully',
      account: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating proxy account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test proxy account login
router.post('/test-login/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const accountResult = await pool.query(
      'SELECT * FROM proxy_accounts WHERE id = $1',
      [id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Proxy account not found' });
    }

    const account = accountResult.rows[0];
    
    // In a real implementation, you would use the proxyService to test the login
    // This is a simulation
    const loginSuccessful = Math.random() > 0.2; // 80% success rate for demo
    
    if (loginSuccessful) {
      // Update last_login time
      await pool.query(
        'UPDATE proxy_accounts SET last_login = NOW() WHERE id = $1',
        [id]
      );
      
      res.json({ 
        success: true, 
        message: 'Login successful',
        balance: (Math.random() * 2000).toFixed(2) // Simulated balance
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Login failed: Invalid credentials' 
      });
    }
  } catch (error) {
    console.error('Error testing login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get system configuration
router.get('/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM system_config WHERE id = 1');
    
    if (result.rows.length === 0) {
      // Return default config if none exists
      const defaultConfig = {
        routing_strategy: 'load-balancing',
        amount_threshold: 10000,
        failover_strategy: 'auto-switch'
      };
      
      // Insert default config
      await pool.query(`
        INSERT INTO system_config (routing_strategy, amount_threshold, failover_strategy)
        VALUES ($1, $2, $3)
      `, [defaultConfig.routing_strategy, defaultConfig.amount_threshold, defaultConfig.failover_strategy]);
      
      return res.json(defaultConfig);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching system config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update system configuration
router.put('/config', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { routing_strategy, amount_threshold, failover_strategy } = req.body;
    
    const result = await pool.query(`
      UPDATE system_config 
      SET routing_strategy = $1, amount_threshold = $2, failover_strategy = $3, updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `, [routing_strategy, amount_threshold, failover_strategy]);
    
    res.json({
      message: 'Configuration updated successfully',
      config: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating system config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
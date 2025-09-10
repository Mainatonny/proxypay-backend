const pool = require('../config/database');

class Order {
  // Create a new order
  static async create(userId, amount, paymentMethod, proxyAccountId = null) {
    const result = await pool.query(
      `INSERT INTO orders (user_id, amount, payment_method, proxy_account_id, status) 
       VALUES ($1, $2, $3, $4, 'pending') 
       RETURNING *`,
      [userId, amount, paymentMethod, proxyAccountId]
    );
    
    return result.rows[0];
  }
  
  // Find order by ID
  static async findById(id) {
    const result = await pool.query(
      `SELECT o.*, a.username as user_username, pa.username as proxy_username, pm.name as payment_method_name
       FROM orders o
       LEFT JOIN accounts a ON o.user_id = a.id
       LEFT JOIN proxy_accounts pa ON o.proxy_account_id = pa.id
       LEFT JOIN payment_methods pm ON o.payment_method = pm.id
       WHERE o.id = $1`,
      [id]
    );
    
    return result.rows[0];
  }
  
  // Update order status
  static async updateStatus(id, status) {
    const result = await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    return result.rows[0];
  }
  
  // Get orders by user ID
  static async findByUserId(userId, limit = 10, offset = 0) {
    const result = await pool.query(
      `SELECT o.*, pm.name as payment_method_name 
       FROM orders o 
       LEFT JOIN payment_methods pm ON o.payment_method = pm.id 
       WHERE o.user_id = $1 
       ORDER BY o.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    
    return result.rows;
  }
  
  // Get orders with filters
  static async findWithFilters(filters = {}, limit = 10, offset = 0) {
    let query = `
      SELECT o.*, a.username, pm.name as payment_method_name 
      FROM orders o 
      LEFT JOIN accounts a ON o.user_id = a.id 
      LEFT JOIN payment_methods pm ON o.payment_method = pm.id 
      WHERE 1=1
    `;
    let params = [];
    let paramCount = 0;
    
    if (filters.status) {
      paramCount++;
      query += ` AND o.status = $${paramCount}`;
      params.push(filters.status);
    }
    
    if (filters.start_date) {
      paramCount++;
      query += ` AND o.created_at >= $${paramCount}`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      paramCount++;
      query += ` AND o.created_at <= $${paramCount}`;
      params.push(filters.end_date);
    }
    
    if (filters.user_id) {
      paramCount++;
      query += ` AND o.user_id = $${paramCount}`;
      params.push(filters.user_id);
    }
    
    query += ` ORDER BY o.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    return result.rows;
  }
  
  // Count orders with filters
  static async countWithFilters(filters = {}) {
    let query = 'SELECT COUNT(*) FROM orders o WHERE 1=1';
    let params = [];
    let paramCount = 0;
    
    if (filters.status) {
      paramCount++;
      query += ` AND o.status = $${paramCount}`;
      params.push(filters.status);
    }
    
    if (filters.start_date) {
      paramCount++;
      query += ` AND o.created_at >= $${paramCount}`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      paramCount++;
      query += ` AND o.created_at <= $${paramCount}`;
      params.push(filters.end_date);
    }
    
    if (filters.user_id) {
      paramCount++;
      query += ` AND o.user_id = $${paramCount}`;
      params.push(filters.user_id);
    }
    
    const result = await pool.query(query, params);
    
    return parseInt(result.rows[0].count);
  }
}

module.exports = Order;
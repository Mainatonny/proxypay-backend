const pool = require('../config/database');

// Log an event to the database
const logEvent = async (level, message, details = null, userId = null) => {
  try {
    await pool.query(
      'INSERT INTO logs (level, message, details, user_id) VALUES ($1, $2, $3, $4)',
      [level, message, details, userId]
    );
  } catch (error) {
    console.error('Failed to log event:', error);
  }
};

// Get logs with optional filters
const getLogs = async (filters = {}, limit = 50, offset = 0) => {
  try {
    let query = 'SELECT l.*, a.username FROM logs l LEFT JOIN accounts a ON l.user_id = a.id WHERE 1=1';
    let params = [];
    let paramCount = 0;
    
    if (filters.level) {
      paramCount++;
      query += ` AND l.level = $${paramCount}`;
      params.push(filters.level);
    }
    
    if (filters.start_date) {
      paramCount++;
      query += ` AND l.timestamp >= $${paramCount}`;
      params.push(filters.start_date);
    }
    
    if (filters.end_date) {
      paramCount++;
      query += ` AND l.timestamp <= $${paramCount}`;
      params.push(filters.end_date);
    }
    
    if (filters.user_id) {
      paramCount++;
      query += ` AND l.user_id = $${paramCount}`;
      params.push(filters.user_id);
    }
    
    query += ` ORDER BY l.timestamp DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM logs l WHERE 1=1';
    let countParams = [];
    let countParamCount = 0;
    
    if (filters.level) {
      countParamCount++;
      countQuery += ` AND l.level = $${countParamCount}`;
      countParams.push(filters.level);
    }
    
    if (filters.start_date) {
      countParamCount++;
      countQuery += ` AND l.timestamp >= $${countParamCount}`;
      countParams.push(filters.start_date);
    }
    
    if (filters.end_date) {
      countParamCount++;
      countQuery += ` AND l.timestamp <= $${countParamCount}`;
      countParams.push(filters.end_date);
    }
    
    if (filters.user_id) {
      countParamCount++;
      countQuery += ` AND l.user_id = $${countParamCount}`;
      countParams.push(filters.user_id);
    }
    
    const countResult = await pool.query(countQuery, countParams);
    
    return {
      logs: result.rows,
      total: parseInt(countResult.rows[0].count)
    };
  } catch (error) {
    console.error('Error fetching logs:', error);
    throw error;
  }
};

module.exports = {
  logEvent,
  getLogs
};
const pool = require('../config/database');

class Config {
  // Get system configuration
  static async get() {
    const result = await pool.query('SELECT * FROM system_config WHERE id = 1');
    
    if (result.rows.length === 0) {
      // Create default config if it doesn't exist
      const defaultConfig = {
        routing_strategy: 'load-balancing',
        amount_threshold: 10000,
        failover_strategy: 'auto-switch'
      };
      
      await pool.query(
        `INSERT INTO system_config (routing_strategy, amount_threshold, failover_strategy)
         VALUES ($1, $2, $3)`,
        [defaultConfig.routing_strategy, defaultConfig.amount_threshold, defaultConfig.failover_strategy]
      );
      
      return defaultConfig;
    }
    
    return result.rows[0];
  }
  
  // Update system configuration
  static async update(updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    if (updates.routing_strategy !== undefined) {
      fields.push(`routing_strategy = $${paramCount}`);
      values.push(updates.routing_strategy);
      paramCount++;
    }
    
    if (updates.amount_threshold !== undefined) {
      fields.push(`amount_threshold = $${paramCount}`);
      values.push(updates.amount_threshold);
      paramCount++;
    }
    
    if (updates.failover_strategy !== undefined) {
      fields.push(`failover_strategy = $${paramCount}`);
      values.push(updates.failover_strategy);
      paramCount++;
    }
    
    fields.push(`updated_at = NOW()`);
    
    values.push(1); // ID is always 1 for now
    
    const query = `UPDATE system_config SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    const result = await pool.query(query, values);
    
    return result.rows[0];
  }
}

module.exports = Config;
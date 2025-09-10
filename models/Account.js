const pool = require('../config/database');

class Account {
  // Create a new account
  static async create(username, password, role = 'user') {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO accounts (username, password, role) VALUES ($1, $2, $3) RETURNING *',
      [username, hashedPassword, role]
    );
    
    return result.rows[0];
  }
  
  // Find account by username
  static async findByUsername(username) {
    const result = await pool.query(
      'SELECT * FROM accounts WHERE username = $1',
      [username]
    );
    
    return result.rows[0];
  }
  
  // Find account by ID
  static async findById(id) {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM accounts WHERE id = $1',
      [id]
    );
    
    return result.rows[0];
  }
  
  // Update account
  static async update(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;
    
    if (updates.username) {
      fields.push(`username = $${paramCount}`);
      values.push(updates.username);
      paramCount++;
    }
    
    if (updates.password) {
      const hashedPassword = await bcrypt.hash(updates.password, 10);
      fields.push(`password = $${paramCount}`);
      values.push(hashedPassword);
      paramCount++;
    }
    
    if (updates.role) {
      fields.push(`role = $${paramCount}`);
      values.push(updates.role);
      paramCount++;
    }
    
    fields.push(`updated_at = NOW()`);
    
    values.push(id);
    
    const query = `UPDATE accounts SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING id, username, role, created_at`;
    
    const result = await pool.query(query, values);
    
    return result.rows[0];
  }
  
  // Delete account
  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM accounts WHERE id = $1 RETURNING id',
      [id]
    );
    
    return result.rows[0];
  }
}

module.exports = Account;
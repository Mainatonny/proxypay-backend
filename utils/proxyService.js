const pool = require('../config/database');

// Select the best proxy account based on routing strategy
const selectProxyAccount = async (amount) => {
  try {
    // Get system configuration
    const configResult = await pool.query('SELECT * FROM system_config WHERE id = 1');
    const config = configResult.rows[0] || {
      routing_strategy: 'load-balancing',
      amount_threshold: 10000,
      failover_strategy: 'auto-switch'
    };
    
    let proxyAccount;
    
    switch (config.routing_strategy) {
      case 'priority':
        // Select based on priority (highest priority first)
        proxyAccount = await selectByPriority();
        break;
      
      case 'threshold':
        // Select based on amount threshold
        proxyAccount = await selectByThreshold(amount, config.amount_threshold);
        break;
      
      case 'load-balancing':
      default:
        // Default to load balancing (round-robin)
        proxyAccount = await selectByLoadBalancing();
        break;
    }
    
    return proxyAccount;
  } catch (error) {
    console.error('Error selecting proxy account:', error);
    return null;
  }
};

// Select proxy account by priority (highest priority first)
const selectByPriority = async () => {
  const result = await pool.query(`
    SELECT * FROM proxy_accounts 
    WHERE status = 'active' AND balance > 0 
    ORDER BY priority ASC, last_used ASC 
    LIMIT 1
  `);
  
  if (result.rows.length > 0) {
    // Update last_used timestamp
    await pool.query(
      'UPDATE proxy_accounts SET last_used = NOW() WHERE id = $1',
      [result.rows[0].id]
    );
    
    return result.rows[0];
  }
  
  return null;
};

// Select proxy account by amount threshold
const selectByThreshold = async (amount, threshold) => {
  // If amount is above threshold, use highest priority account
  if (amount > threshold) {
    const result = await pool.query(`
      SELECT * FROM proxy_accounts 
      WHERE status = 'active' AND balance >= $1 
      ORDER BY priority ASC, balance DESC 
      LIMIT 1
    `, [amount]);
    
    if (result.rows.length > 0) {
      await pool.query(
        'UPDATE proxy_accounts SET last_used = NOW() WHERE id = $1',
        [result.rows[0].id]
      );
      
      return result.rows[0];
    }
  }
  
  // For amounts below threshold or if no account found, use load balancing
  return selectByLoadBalancing();
};

// Select proxy account using load balancing (round-robin)
const selectByLoadBalancing = async () => {
  const result = await pool.query(`
    SELECT * FROM proxy_accounts 
    WHERE status = 'active' AND balance > 0 
    ORDER BY last_used ASC 
    LIMIT 1
  `);
  
  if (result.rows.length > 0) {
    await pool.query(
      'UPDATE proxy_accounts SET last_used = NOW() WHERE id = $1',
      [result.rows[0].id]
    );
    
    return result.rows[0];
  }
  
  return null;
};

// Test proxy account login
const testProxyAccountLogin = async (accountId) => {
  try {
    const accountResult = await pool.query(
      'SELECT * FROM proxy_accounts WHERE id = $1',
      [accountId]
    );
    
    if (accountResult.rows.length === 0) {
      return { success: false, error: 'Account not found' };
    }
    
    const account = accountResult.rows[0];
    
    // In a real implementation, you would make an API call to the platform
    // to test the login credentials
    
    // Simulate API call with random success
    const success = Math.random() > 0.2; // 80% success rate
    
    if (success) {
      // Update last_login time
      await pool.query(
        'UPDATE proxy_accounts SET last_login = NOW(), status = $1 WHERE id = $2',
        ['active', accountId]
      );
      
      return { 
        success: true, 
        message: 'Login successful',
        balance: (Math.random() * 2000).toFixed(2) // Simulated balance
      };
    } else {
      // Mark account as problematic
      await pool.query(
        'UPDATE proxy_accounts SET status = $1 WHERE id = $2',
        ['inactive', accountId]
      );
      
      return { 
        success: false, 
        error: 'Login failed: Invalid credentials' 
      };
    }
  } catch (error) {
    console.error('Error testing proxy account login:', error);
    return { success: false, error: 'Internal server error' };
  }
};

module.exports = {
  selectProxyAccount,
  testProxyAccountLogin
};
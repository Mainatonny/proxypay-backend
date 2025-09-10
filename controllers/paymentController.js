const pool = require('../config/database');
const { selectProxyAccount } = require('../utils/proxyService');

// Process payment using the selected proxy account
const processPayment = async (order, paymentDetails) => {
  try {
    // Select the best proxy account based on routing strategy
    const proxyAccount = await selectProxyAccount(order.amount);
    
    if (!proxyAccount) {
      return { success: false, error: 'No available proxy accounts' };
    }
    
    // Update order with selected proxy account
    await pool.query(
      'UPDATE orders SET proxy_account_id = $1 WHERE id = $2',
      [proxyAccount.id, order.id]
    );
    
    // In a real implementation, you would integrate with the payment gateway here
    // This is a simulation of payment processing
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate success (90% success rate for demo)
    const success = Math.random() < 0.9;
    
    if (success) {
      // Update proxy account balance (simulated)
      const newBalance = parseFloat(proxyAccount.balance) - parseFloat(order.amount);
      await pool.query(
        'UPDATE proxy_accounts SET balance = $1, updated_at = NOW() WHERE id = $2',
        [newBalance, proxyAccount.id]
      );
      
      return { 
        success: true, 
        transaction_id: 'TX-' + Math.random().toString(36).substr(2, 9).toUpperCase()
      };
    } else {
      return { 
        success: false, 
        error: 'Payment gateway declined the transaction' 
      };
    }
  } catch (error) {
    console.error('Error in processPayment:', error);
    return { success: false, error: 'Internal payment processing error' };
  }
};

module.exports = {
  processPayment
};
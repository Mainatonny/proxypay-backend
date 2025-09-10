// mock-alipay.js
const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Fake login endpoint
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    return res.json({ success: true, token: 'fake-token-123' });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

// Fake recharge endpoint
app.get('/recharge', (req, res) => {
  const { amount, order_id } = req.query;
  return res.send(`
    <html>
      <body>
        <a id="recharge-link" href="/pay/${order_id}">Pay ${amount}</a>
      </body>
    </html>
  `);
});

// Recharge page simulation
app.get('/pay/:id', (req, res) => {
  const { id } = req.params;
  const { amount } = req.query;  // passed from backend

  res.send(`
    <html>
      <head><title>Mock Alipay Recharge</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>Awaken Alipay Recharge</h1>
        <p>Order ID: <b>${id}</b></p>
        <p>Amount: ¥${amount || 'N/A'}</p>
        <p>Status: Awaiting payment...</p>
        <br/>
        <a href="/pay/${id}/success?amount=${amount}" style="padding: 10px 20px; background: green; color: white; text-decoration: none; border-radius: 5px;">
            Simulate Successful Payment
        </a>
      </body>
    </html>
  `);
});

// Optional: success redirect page
app.get('/pay/:id/success', (req, res) => {
  res.send(`
    <html>
      <head><title>Payment Success</title></head>
      <body style="font-family: Arial; text-align: center; padding: 50px;">
        <h1>Payment Successful</h1>
        <p>Your recharge for order <b>${req.params.id}</b> has been completed.</p>
        <a href="http://localhost:8000/"> Return to Frontend</a>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🟢 Mock Awaken Alipay running at http://localhost:${PORT}`);
});
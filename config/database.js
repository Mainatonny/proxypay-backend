const { Pool } = require('pg');
require('dotenv').config();

let poolConfig;

if (process.env.DATABASE_URL) {
  // Render / Railway / Heroku provide a single DATABASE_URL
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // Render requires SSL
    },
  };
} else {
  // Local development fallback
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'proxypay',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
  };
}

const pool = new Pool(poolConfig);

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error(' Error acquiring client', err.stack);
    process.exit(1);
  }
  console.log(' Connected to PostgreSQL database');
  release();
});

module.exports = pool;
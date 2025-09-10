-- Create database
CREATE DATABASE proxypay;

-- Connect to database
\c proxypay;

-- Create tables
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payment_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE proxy_accounts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    platform VARCHAR(100) NOT NULL,
    balance DECIMAL(10, 2) DEFAULT 0,
    priority INTEGER DEFAULT 1,
    status VARCHAR(20) DEFAULT 'active',
    last_login TIMESTAMP,
    last_used TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES accounts(id),
    amount DECIMAL(10, 2) NOT NULL,
    payment_method INTEGER REFERENCES payment_methods(id),
    proxy_account_id INTEGER REFERENCES proxy_accounts(id),
    status VARCHAR(20) DEFAULT 'pending',
    transaction_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE system_config (
    id SERIAL PRIMARY KEY,
    routing_strategy VARCHAR(50) DEFAULT 'load-balancing',
    amount_threshold DECIMAL(10, 2) DEFAULT 10000,
    failover_strategy VARCHAR(50) DEFAULT 'auto-switch',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE logs (
    id SERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    user_id INTEGER REFERENCES accounts(id),
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Insert initial data
INSERT INTO payment_methods (name) VALUES 
('Alipay'),
('WeChat Pay');

INSERT INTO system_config (routing_strategy, amount_threshold, failover_strategy) VALUES 
('load-balancing', 10000, 'auto-switch');

-- Create indexes for better performance
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_proxy_accounts_status ON proxy_accounts(status);
CREATE INDEX idx_proxy_accounts_priority ON proxy_accounts(priority);
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
-- Migration: users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(20) PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    balance BIGINT DEFAULT 1000,
    bank_balance BIGINT DEFAULT 0,
    bankruptcies INT DEFAULT 0,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    created_at BIGINT NOT NULL,
    last_daily BIGINT
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
-- ============================================================
-- setup.sql — Run this in MySQL Workbench or MySQL CLI
-- to manually create the database and table
--
-- HOW TO USE:
--   Option A: The server creates this automatically when you start it
--   Option B: Run this file manually in MySQL:
--     mysql -u root -p < setup.sql
-- ============================================================

-- Create the database if it doesn't exist
-- (The backticks handle names with special characters)
CREATE DATABASE IF NOT EXISTS `pricetracker`;

-- Switch to using this database
USE `pricetracker`;

-- Create the price_history table
-- IF NOT EXISTS = don't throw an error if it already exists
CREATE TABLE IF NOT EXISTS `price_history` (
  `id`         INT          AUTO_INCREMENT PRIMARY KEY,
  -- id: automatically assigned number for each row (1, 2, 3, ...)
  -- AUTO_INCREMENT: database handles this, you don't set it manually
  -- PRIMARY KEY: used to uniquely identify each row

  `url`        TEXT         NOT NULL,
  -- Full product URL (TEXT can store very long strings)
  -- NOT NULL: required — can't be empty

  `title`      VARCHAR(500) NULL,
  -- Product name (up to 500 characters, can be NULL if scraping fails)

  `price`      VARCHAR(100) NOT NULL,
  -- Stored as text: "₹1,299" — includes the currency symbol

  `site`       VARCHAR(50)  NULL,
  -- "Amazon" or "Flipkart"

  `fetched_at` TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
  -- Automatically set to the current date+time when a row is inserted
  -- Format: 2024-12-01 10:30:00
);

-- Show a confirmation message
SELECT 'Database and table created successfully!' AS message;

-- ─────────────────────────────────────────────
-- USEFUL QUERIES (for learning/testing)
-- ─────────────────────────────────────────────

-- View all saved prices:
-- SELECT * FROM price_history ORDER BY fetched_at DESC;

-- View only Amazon prices:
-- SELECT title, price, fetched_at FROM price_history WHERE site = 'Amazon';

-- Count total tracked prices:
-- SELECT COUNT(*) AS total_tracked FROM price_history;

-- Delete everything (start fresh):
-- DELETE FROM price_history;

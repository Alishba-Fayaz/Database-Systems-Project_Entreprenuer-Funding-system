-- ENTREPRENEUR FUNDING PLATFORM - DATABASE SETUP

CREATE DATABASE IF NOT EXISTS entrepreneur_funding;
USE entrepreneur_funding;

-- 1. ROLE TABLE
CREATE TABLE IF NOT EXISTS ROLE (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

-- 2. USER TABLE
CREATE TABLE IF NOT EXISTS USERS (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    role_id INT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES ROLE(role_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- 3. VERIFICATION TABLE
CREATE TABLE IF NOT EXISTS VERIFICATION (
    verification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    id_type VARCHAR(50) NOT NULL,
    id_number VARCHAR(50) NOT NULL,
    status ENUM('Pending','Approved','Rejected') DEFAULT 'Pending',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES USERS(user_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- 4. CATEGORY TABLE
CREATE TABLE IF NOT EXISTS CATEGORY (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE
);

-- 5. PROJECT TABLE
CREATE TABLE IF NOT EXISTS PROJECT (
    project_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    funding_goal DECIMAL(12,2) NOT NULL CHECK (funding_goal > 0),
    deadline DATE NOT NULL,
    status ENUM('Active','Funded','Closed') DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    entrepreneur_id INT NOT NULL,
    category_id INT NOT NULL,
    FOREIGN KEY (entrepreneur_id) REFERENCES USERS(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
    FOREIGN KEY (category_id) REFERENCES CATEGORY(category_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- 6. INVESTMENT TABLE
CREATE TABLE IF NOT EXISTS INVESTMENT (
    investment_id INT AUTO_INCREMENT PRIMARY KEY,
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    invested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    project_id INT NOT NULL,
    investor_id INT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES PROJECT(project_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    FOREIGN KEY (investor_id) REFERENCES USERS(user_id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE
);

-- 7. FUNDING TRACKER TABLE
CREATE TABLE IF NOT EXISTS FUNDING_TRACKER (
    tracker_id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL UNIQUE,
    total_collected DECIMAL(12,2) DEFAULT 0,
    remaining_amount DECIMAL(12,2) DEFAULT 0,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES PROJECT(project_id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

-- SEED DATA - Roles
INSERT IGNORE INTO ROLE (role_id, role_name) VALUES
(1, 'Ordinary User'),
(2, 'Entrepreneur'),
(3, 'Investor');

-- SEED DATA - Categories
INSERT IGNORE INTO CATEGORY (category_id, category_name) VALUES
(1,  'Technology'),
(2,  'Healthcare'),
(3,  'Education'),
(4,  'Agriculture'),
(5,  'Finance'),
(6,  'Energy'),
(7,  'Real Estate'),
(8,  'E-Commerce'),
(9,  'Food & Beverage'),
(10, 'Entertainment');

-- SEED DATA - Users (passwords stored as plain text)
-- Ordinary Users: role_id = 1
-- Entrepreneurs:  role_id = 2
-- Investors:      role_id = 3
INSERT IGNORE INTO USERS (user_id, name, email, password, role_id) VALUES
-- Ordinary Users
(1,  'Ali Hassan',       'ali@example.com',     'ali123',       1),
(2,  'Sara Khan',        'sara@example.com',    'sara123',      1),
-- Entrepreneurs
(3,  'Ahmed Raza',       'ahmed@example.com',   'ahmed123',     2),
(4,  'Fatima Malik',     'fatima@example.com',  'fatima123',    2),
(5,  'Usman Tariq',      'usman@example.com',   'usman123',     2),
-- Investors
(6,  'Bilal Sheikh',     'bilal@example.com',   'bilal123',     3),
(7,  'Zainab Hussain',   'zainab@example.com',  'zainab123',    3),
(8,  'Omar Farooq',      'omar@example.com',    'omar123',      3);

-- ============================================================
-- SEED DATA - Projects
-- ============================================================
INSERT IGNORE INTO PROJECT (project_id, title, description, funding_goal, deadline, status, entrepreneur_id, category_id) VALUES
(1, 'EduBot AI Tutor',
    'An AI-powered tutoring platform for school students in Pakistan. It provides personalized lessons in Math, Science and English.',
    500000.00, '2025-12-31', 'Active', 3, 1),

(2, 'GreenFarm IoT',
    'Smart sensors for small farms to monitor soil, water, and weather. Helps farmers increase crop yield by 30 percent.',
    750000.00, '2025-11-30', 'Active', 3, 4),

(3, 'MediConnect App',
    'A telemedicine mobile app connecting rural patients with certified doctors. Includes prescription and lab test booking.',
    1200000.00, '2025-10-15', 'Active', 4, 2),

(4, 'SolarGrid Pakistan',
    'Affordable solar panel installation service for middle-income households. Pay in monthly installments over 3 years.',
    2000000.00, '2025-09-30', 'Funded', 4, 6),

(5, 'LocalBazaar Online',
    'An e-commerce platform connecting local artisans and small shop owners across Pakistan to online buyers.',
    600000.00, '2026-01-31', 'Active', 5, 8),

(6, 'CookCloud Kitchen',
    'A cloud kitchen startup offering home-cooked meal delivery service in Lahore. Franchise model after 6 months.',
    400000.00, '2025-08-31', 'Active', 5, 9);

-- SEED DATA - Investments
INSERT IGNORE INTO INVESTMENT (investment_id, amount, project_id, investor_id) VALUES
(1,  150000.00, 1, 6),
(2,  200000.00, 1, 7),
(3,  100000.00, 2, 6),
(4,  300000.00, 2, 8),
(5,  500000.00, 3, 7),
(6,  250000.00, 4, 6),
(7,  750000.00, 4, 7),
(8, 1000000.00, 4, 8),
(9,  200000.00, 5, 6),
(10, 100000.00, 6, 7);

-- SEED DATA - Funding Tracker
-- (total_collected = sum of investments per project)
INSERT IGNORE INTO FUNDING_TRACKER (project_id, total_collected, remaining_amount) VALUES
(1,  350000.00,  150000.00),
(2,  400000.00,  350000.00),
(3,  500000.00,  700000.00),
(4, 2000000.00,       0.00),
(5,  200000.00,  400000.00),
(6,  100000.00,  300000.00);

-- SEED DATA - Verifications (for ordinary users)
INSERT IGNORE INTO VERIFICATION (user_id, id_type, id_number, status) VALUES
(1, 'CNIC', '35202-1234567-1', 'Approved'),
(2, 'CNIC', '35202-7654321-9', 'Pending');

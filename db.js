// db.js - Database Connection

const mysql = require('mysql2');

// Create a connection pool (handles multiple requests efficiently)
const pool = mysql.createPool({
    host:     'localhost',
    user:     'root',
    password: '',                       // Default XAMPP MySQL password is empty
    database: 'entrepreneur_funding',
    port:     3306
});

// Test the connection when the server starts
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection FAILED:', err.message);
        console.error('Make sure XAMPP MySQL is running and database.sql has been imported.');
    } else {
        console.log('MySQL database connected successfully.');
        connection.release();
    }
});

// Export as promise-based pool so we can use async/await in routes
module.exports = pool.promise();

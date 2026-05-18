// server.js - Main Express Server

const express = require('express');
const session = require('express-session');
const path    = require('path');

const authRoutes         = require('./routes/auth');
const entrepreneurRoutes = require('./routes/entrepreneur');
const investorRoutes     = require('./routes/investor');
const userRoutes         = require('./routes/user');
const commonRoutes       = require('./routes/common');

const app  = express();
const PORT = 3000;

// ---- Middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve all HTML, CSS, JS from the /public folder
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
    secret:            'ventureflow_secret',
    resave:            false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }   // Session lasts 24 hours
}));

// ---- API Routes ----
app.use('/api/auth',         authRoutes);
app.use('/api/entrepreneur', entrepreneurRoutes);
app.use('/api/investor',     investorRoutes);
app.use('/api/user',         userRoutes);
app.use('/api/common',       commonRoutes);

// ---- Page Routes ----
app.get('/',             (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/entrepreneur', (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'entrepreneur_dashboard.html')));
app.get('/investor',     (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'investor_dashboard.html')));
app.get('/dashboard',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'pages', 'user_dashboard.html')));

// ---- Start Server ----
app.listen(PORT, () => {
    console.log('---------------------------------------------');
    console.log('  VentureFlow server is running!');
    console.log('  Open: http://localhost:' + PORT);
    console.log('---------------------------------------------');
});

// dloms_project/backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator'); // For input validation
const jwt = require('jsonwebtoken'); // For generating JWTs
const User = require('../models/User'); // User model
const { protect } = require('../middleware/authMiddleware'); // Middleware to protect routes

// Helper function to generate a JWT token
const generateToken = (id, username, role) => {
    return jwt.sign({ id, username, role }, process.env.JWT_SECRET, {
        expiresIn: '1h' // Token expires in 1 hour (adjust lifetime as per security needs)
    });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public (Initially for setup; typically restricted to 'admin' in production)
// @comment FRONTEND API INTEGRATION POINT:
//          Your frontend's registration form will POST data to this endpoint.
//          Example: `api.post('/api/auth/register', { username: '...', password: '...', email: '...' })`
router.post(
    '/register',
    [
        // Input validation using express-validator
        body('username').trim().notEmpty().withMessage('Username is required').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
        body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Must be a valid email address'),
        body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').optional().isIn(['field_officer', 'admin', 'verifier']).withMessage('Invalid role provided')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, role } = req.body;

        try {
            // Check if user already exists by username or email
            let user = await User.findOne({ $or: [{ username }, { email }] });
            if (user) {
                return res.status(409).json({ message: 'User with this username or email already exists' });
            }

            // Create a new user instance (password will be hashed by pre-save hook)
            user = new User({
                username,
                email,
                password,
                role: role || 'field_officer' // Default to field_officer if not provided
            });

            await user.save(); // Save the new user to the database

            // Generate a token immediately after registration for convenience
            const token = generateToken(user._id, user.username, user.role);

            res.status(201).json({
                message: 'User registered successfully',
                userId: user._id,
                username: user.username,
                role: user.role,
                token // Send token to frontend for immediate login
            });
        } catch (error) {
            console.error('Registration error:', error.message);
            res.status(500).json({ message: 'Server error during registration' });
        }
    }
);

// @route   POST /api/auth/login
// @desc    Authenticate user & get JWT token
// @access  Public
// @comment FRONTEND API INTEGRATION POINT:
//          Your frontend's login form will POST data to this endpoint.
//          Example: `api.post('/api/auth/login', { username: '...', password: '...' })`
//          On success, store the `token` (e.g., in localStorage or Redux state) for future authenticated requests.
router.post(
    '/login',
    [
        body('username').trim().notEmpty().withMessage('Username is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            // Find user by username
            const user = await User.findOne({ username });

            if (!user) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Compare entered password with hashed password
            const isMatch = await user.matchPassword(password);

            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Generate and send JWT token
            const token = generateToken(user._id, user.username, user.role);

            res.json({
                message: 'Logged in successfully',
                userId: user._id,
                username: user.username,
                role: user.role,
                token
            });
        } catch (error) {
            console.error('Login error:', error.message);
            res.status(500).json({ message: 'Server error during login' });
        }
    }
);

// @route   GET /api/auth/profile
// @desc    Get user profile details (protected route)
// @access  Private (requires valid JWT token)
// @comment FRONTEND API INTEGRATION POINT:
//          After login, the frontend can call this to fetch the current user's details.
//          Include the JWT in the Authorization header: `Authorization: Bearer YOUR_TOKEN`
//          Example: `api.get('/api/auth/profile', { headers: { Authorization: `Bearer ${token}` } })`
router.get('/profile', protect, async (req, res) => {
    // `req.user` is populated by the `protect` middleware
    res.json({
        userId: req.user._id,
        username: req.user.username,
        role: req.user.role,
        email: req.user.email,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt
    });
});

module.exports = router;
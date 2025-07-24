// dloms_project/backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Import the User model

// Middleware to protect routes: ensures only authenticated users can access
const protect = async (req, res, next) => {
    let token;

    // Check if Authorization header is present and starts with 'Bearer'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Get token from header (e.g., "Bearer eyJhbGciOi...")
            token = req.headers.authorization.split(' ')[1];

            // Verify the token using the secret key
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Find the user by ID from the token's payload
            // .select('-password') excludes the password hash from the retrieved user object
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                // If user doesn't exist (e.g., deleted), token is invalid
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
            next(); // Proceed to the next middleware/route handler
        } catch (error) {
            console.error(error);
            // If token is invalid (e.g., expired, malformed), respond with 401
            res.status(401).json({ message: 'Not authorized, token failed or expired' });
        }
    }

    // If no token is provided in the header
    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token provided' });
    }
};

// Middleware for role-based authorization
// Usage: router.get('/admin-only', protect, authorize('admin'), (req, res) => { ... });
const authorize = (...roles) => {
    return (req, res, next) => {
        // req.user is populated by the `protect` middleware
        if (!req.user || !roles.includes(req.user.role)) {
            // If user's role is not in the allowed roles list
            return res.status(403).json({ message: `Access denied. Role '${req.user ? req.user.role : 'none'}' is not authorized for this action.` });
        }
        next(); // User is authorized, proceed
    };
};

module.exports = { protect, authorize };
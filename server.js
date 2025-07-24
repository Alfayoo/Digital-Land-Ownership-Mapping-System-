// dloms_project/backend/server.js
require('dotenv').config(); // Load environment variables from .env at the very top
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Node.js built-in file system module

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGO_URI;
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || 'uploads';

// --- MongoDB Connection ---
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        // It's critical to exit if DB connection fails, as the app can't function
        process.exit(1);
    });

// --- Middleware ---
app.use(express.json()); // Body parser for JSON requests (e.g., login, register)
app.use(express.urlencoded({ extended: true })); // Body parser for URL-encoded requests

// Configure CORS (Cross-Origin Resource Sharing)
// This is essential for your frontend (running on a different port/domain) to communicate with your backend.
const corsOptions = {
    origin: process.env.FRONTEND_URL, // Whitelist your React frontend's URL
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Allowed HTTP methods
    credentials: true, // Allow cookies and authentication headers (like JWT)
    optionsSuccessStatus: 204 // For preflight requests
};
app.use(cors(corsOptions));

// Serve static files from the 'uploads' folder
// This makes uploaded documents accessible via URL like http://localhost:5000/api/files/documents/some_file.pdf
app.use('/api/files/documents', express.static(path.join(__dirname, UPLOAD_FOLDER)));

// Create uploads directory if it doesn't exist (important for Multer)
const uploadsDirPath = path.join(__dirname, UPLOAD_FOLDER);
if (!fs.existsSync(uploadsDirPath)) {
    fs.mkdirSync(uploadsDirPath, { recursive: true });
}

// --- Root Route ---
app.get('/', (req, res) => {
    res.send('DLOMS Node.js Backend API is running!');
});

// --- API Routes ---
// These are the main entry points for your frontend to interact with the backend.
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/parcels', require('./routes/parcelRoutes'));// Handles land parcel CRUD operations

// Global Error Handling Middleware (should be the last `app.use` after all routes)
// Catches any errors thrown by routes or middleware above.
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging
    res.status(err.statusCode || 500).json({
        message: err.message || 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'development' ? err : {} // Provide more details in dev
    });
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`MongoDB URI: ${MONGODB_URI}`);
    console.log(`CORS allowed origin: ${process.env.FRONTEND_URL}`);
});
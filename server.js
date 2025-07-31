// dloms_project/backend/server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); 

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGO_URI;
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || 'uploads';
const offersRoutes = require("./routes/offers");
const uploadRoute = require('./routes/upload');
const submitOfferRoute = require("./routes/submitOffer");
const sellersRoute = require("./routes/sellers");
// --- MongoDB Connection ---
mongoose.connect(MONGODB_URI)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1); 
    });

// --- Middleware ---
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 


const corsOptions = {
    origin: process.env.FRONTEND_URL, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Serve static files from the 'uploads' folder for uploaded documents
app.use('/api/files/documents', express.static(path.join(__dirname, UPLOAD_FOLDER)));
app.use("/api/offers", offersRoutes);
app.use('/api', uploadRoute);
app.use("/api/submitOffer", submitOfferRoute);
app.use("/api/sellers", sellersRoute);
// Create uploads directory if it doesn't exist (important for Multer)
const uploadsDirPath = path.join(__dirname, UPLOAD_FOLDER);
if (!fs.existsSync(uploadsDirPath)) {
    fs.mkdirSync(uploadsDirPath, { recursive: true });
}


// These MUST be defined BEFORE any static file serving or catch-all routes.
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/parcels', require('./routes/parcelRoutes')); 

// --- Serve Static Frontend Files from the 'shamba' directory ---



// Define the path to your 'shamba' frontend directory (assumes it's in the project root)
const frontendDir = path.join(__dirname, 'shamba');
app.use(express.static(frontendDir)); 

// Catch-all route: For any GET request that hasn't matched an API route or a static file,

app.get('*', (req, res) => {
    res.sendFile(path.resolve(frontendDir, 'globe.html'));
});


// Global Error Handling Middleware (must be the very last `app.use`)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({
        message: err.message || 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// --- Start Server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`MongoDB URI: ${MONGODB_URI}`);
    console.log(`CORS allowed origin: ${process.env.FRONTEND_URL}`);
    console.log(`Frontend files served from: ${frontendDir}`); 
});
// dloms_project/backend/utils/fileUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Node.js built-in file system module

const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER || 'uploads';
const uploadsDirPath = path.join(__dirname, '..', UPLOAD_FOLDER); // Path to the uploads folder

// Ensure the uploads directory exists
if (!fs.existsSync(uploadsDirPath)) {
    fs.mkdirSync(uploadsDirPath, { recursive: true });
}

// Configure storage for uploaded files using Multer's diskStorage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // `cb` is the callback function (error, destination_path)
        cb(null, uploadsDirPath); // Files will be stored in the 'uploads' folder
    },
    filename: (req, file, cb) => {
        // Generate a unique filename to prevent conflicts.
        // Includes parcelId (from request body), timestamp, and original extension.
        // It's crucial that `parcelId` is sent in the form-data along with the file.
        let filenamePrefix = req.body.parcelId || 'unknown_parcel';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const originalExt = path.extname(file.originalname); // E.g., ".pdf", ".jpg"
        cb(null, `${filenamePrefix}_${uniqueSuffix}${originalExt}`);
    }
});

// Configure file filtering (optional, but good for security and validation)
const fileFilter = (req, file, cb) => {
    // Regular expression to test allowed file extensions and MIME types
    const filetypes = /jpeg|jpg|png|pdf|doc|docx/; // Allowed extensions: images and common document types
    const mimetype = filetypes.test(file.mimetype); // Test file's MIME type
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase()); // Test file's extension

    if (mimetype && extname) {
        return cb(null, true); // Accept the file
    } else {
        cb(new Error('Error: File upload only supports images (jpeg, jpg, png), PDFs, and Word documents!')); // Reject with an error
    }
};

// Initialize Multer upload instance
const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 10 }, // File size limit: 10MB (adjust as needed)
    fileFilter: fileFilter
});

module.exports = upload;
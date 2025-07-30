// server.js or routes/upload.js
const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary'); // import your config
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const router = express.Router();

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    },
});

const upload = multer({ storage });

// POST route to upload image
router.post('/upload', upload.single('file'), (req, res) => {
  console.log("File received:", req.file); // ✅ See what Multer got

  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({ url: req.file.path });
});


module.exports = router;

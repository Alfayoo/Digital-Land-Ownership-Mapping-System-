const express = require("express");
const router = express.Router();
const Seller = require("../models/Seller");

// GET /api/sellers - Get all seller offers
router.get("/", async (req, res) => {
  try {
    const sellers = await Seller.find().sort({ createdAt: -1 }); // Newest first
    res.json(sellers);
  } catch (err) {
    console.error("Error fetching sellers:", err);
    res.status(500).json({ error: "Failed to fetch sellers" });
  }
});

module.exports = router;

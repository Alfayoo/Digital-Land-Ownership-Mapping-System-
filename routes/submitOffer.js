const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

// Optional: create a Seller model if you haven't yet
const SellerSchema = new mongoose.Schema({
  fullName: String,
  phoneNumber: String,
  parcelId: String,
  landSize: String,
  titleDeedUrl: String,
  idUrl: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Seller = mongoose.model("Seller", SellerSchema);

// POST /api/submitOffer
router.post("/", async (req, res) => {
    console.log("Received body:", req.body);
  try {
    const { fullName, phoneNumber, parcelId, landSize, titleDeedUrl, idUrl } = req.body;

    if (!fullName || !phoneNumber || !parcelId || !landSize || !titleDeedUrl || !idUrl) {
      return res.status(400).send("Missing required fields.");
    }

    const newSeller = new Seller({
      fullName,
      phoneNumber,
      parcelId,
      landSize,
      titleDeedUrl,
      idUrl,
    });

    await newSeller.save();

    res.status(201).send("Offer submitted successfully.");
  } catch (err) {
    console.error("Error saving seller:", err);
    res.status(500).send("Server error submitting offer.");
  }
});

module.exports = router;

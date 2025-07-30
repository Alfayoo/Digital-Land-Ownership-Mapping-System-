const express = require("express");
const router = express.Router();
const Offer = require("../models/Offer");

// POST: Create new offer
router.post("/", async (req, res) => {
  try {
    const { parcelId, offerPrice, phoneNumber } = req.body;

    const newOffer = new Offer({ parcelId, offerPrice, phoneNumber });
    await newOffer.save();

    res.status(201).json({ message: "Offer saved!" });
  } catch (err) {
    console.error("Error saving offer:", err);
    res.status(500).json({ message: "Error saving offer", error: err });
  }
});

// GET: Fetch all offers
router.get("/", async (req, res) => {
  try {
    const offers = await Offer.find().sort({ createdAt: -1 }); // newest first
    res.json(offers);
  } catch (err) {
    console.error("Error fetching offers:", err);
    res.status(500).json({ message: "Error fetching offers", error: err });
  }
});


module.exports = router;

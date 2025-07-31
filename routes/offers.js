const express = require("express");
const router = express.Router();
const Offer = require("../models/Offer");


// Africa's Talking setup
const africastalking = require("africastalking")({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME,
});


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



// DELETE route to remove offer and send SMS
router.delete("/:id", async (req, res) => {
  console.log("DELETE request received for ID:", req.params.id);

  try {
    const offer = await Offer.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ message: "Offer not found" });

    // Format phone number for international use
    let formattedPhone = offer.phoneNumber;
    if (formattedPhone.startsWith("07")) {
      formattedPhone = formattedPhone.replace(/^0/, "+254");
    }

    const smsOptions = {
      to: [formattedPhone],
      message: `Your land request for parcel ${offer.parcelId} has been declined.`,
    };

    // Send SMS
    africastalking.SMS.send(smsOptions)
      .then(response => console.log("SMS sent:", response))
      .catch(error => console.error("SMS error:", error));

    res.json({ message: "Offer deleted and SMS sent" });
  } catch (error) {
    console.error("Delete offer error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;

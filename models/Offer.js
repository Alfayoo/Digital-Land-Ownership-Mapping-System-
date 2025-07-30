const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema({
  parcelId: { type: String, required: true },
  offerPrice: { type: Number, required: true },
  phoneNumber: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Offer", offerSchema);

const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    parcelId: { type: String, required: true },
    landSize: { type: String, required: true },
    titleDeedUrl: { type: String, required: true },
    idUrl: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Seller', sellerSchema);

const mongoose = require("mongoose");

const parcelSchema = new mongoose.Schema({
  parcelId: String,
  county: String,
  latitude: Number,
  longitude: Number,
  ownerName: String,         
  ownerIdNumber: String     
});

module.exports = mongoose.model("Parcel", parcelSchema);

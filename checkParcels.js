console.log("Running checkParcels...");

const mongoose = require("mongoose");
const Parcel = require("./models/Parcel"); // adjust path if needed

mongoose.connect("mongodb+srv://Laura:Laura4444@group10.d9ovg6e.mongodb.net/?retryWrites=true&w=majority&appName=Group10");

Parcel.find().then(data => {
  console.log("Parcels in DB:", data);
  mongoose.disconnect();
});

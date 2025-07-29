const mongoose = require("mongoose");
const Parcel = require("../models/Parcel");

const MONGO_URI = "mongodb+srv://glenoanyangu:Game%40thrones1@cluster0.xr5cebj.mongodb.net/dloms_dev_db?retryWrites=true&w=majority&appName=Cluster0";
mongoose.connect(MONGO_URI);

const baseCoords = {
  Nyeri: { lat: -0.4167, lng: 36.9500 },
  Kiambu: { lat: -1.0333, lng: 36.6500 },
  Muranga: { lat: -0.7167, lng: 37.1500 },
  Meru: { lat: 0.0463, lng: 37.6559 },
  Kitui: { lat: -1.3667, lng: 38.0167 },
  Embu: { lat: -0.5333, lng: 37.4500 },
  Marsabit: { lat: 2.3333, lng: 37.9833 },
  Isiolo: { lat: 0.3500, lng: 37.5833 },
  Wajir: { lat: 1.7500, lng: 40.0500 },
  Mombasa: { lat: -4.0435, lng: 39.6682 }
};

async function generateParcels() {
  try {
    await Parcel.deleteMany({});
    console.log("Old parcels deleted.");

    const parcels = [];

    for (const county in baseCoords) {
      const base = baseCoords[county];
      const countyCode = county.substring(0, 3).toUpperCase();

      for (let i = 1; i <= 10; i++) {
        const parcelId = `${countyCode}${i.toString().padStart(3, "0")}`;

        const latOffset = (Math.random() - 0.5) * 0.02;
        const lngOffset = (Math.random() - 0.5) * 0.02;

        parcels.push({
          parcelId,
          county,
          latitude: parseFloat((base.lat + latOffset).toFixed(6)),
          longitude: parseFloat((base.lng + lngOffset).toFixed(6))
        });
      }
    }

    await Parcel.insertMany(parcels);
    console.log("✅ 100 parcels inserted successfully.");
  } catch (err) {
    console.error("❌ Error inserting parcels:", err);
  } finally {
    mongoose.disconnect();
  }
}

generateParcels();

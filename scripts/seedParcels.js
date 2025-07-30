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
  Mombasa: { lat: -4.0435, lng: 39.6682 },
  Nairobi: { lat: -1.2864, lng: 36.8172 },
  Kakamega: { lat: 0.2833, lng: 34.7500 }  
};

// Sample random names generator
const sampleNames = [
  "Alice Mwangi", "Brian Odhiambo", "Catherine Njeri", "David Kiptoo", "Emily Atieno",
  "Fredrick Otieno", "Grace Wanjiku", "Henry Kariuki", "Irene Kemunto", "John Muthoni"
];

function generateRandomOwner() {
  const name = sampleNames[Math.floor(Math.random() * sampleNames.length)];
  const id = Math.floor(10000000 + Math.random() * 89999999); // 8-digit ID
  return { name, id };
}

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

        const { name, id } = generateRandomOwner();

        parcels.push({
          parcelId,
          county,
          latitude: parseFloat((base.lat + latOffset).toFixed(6)),
          longitude: parseFloat((base.lng + lngOffset).toFixed(6)),
          ownerName: name,
          ownerId: id
        });
      }
    }

    await Parcel.insertMany(parcels);
    console.log("✅ 120 parcels with owners inserted successfully.");
  } catch (err) {
    console.error("❌ Error inserting parcels:", err);
  } finally {
    mongoose.disconnect();
  }
}

generateParcels();

// dloms_project/backend/models/LandParcel.js
const mongoose = require('mongoose');

const LandParcelSchema = new mongoose.Schema({
    parcelId: { // This will be the unique identifier for a parcel (e.g., KSM-001-A)
        type: String,
        required: [true, 'Parcel ID is required'],
        unique: true, // Ensures no two parcels have the same ID
        trim: true,
        uppercase: true // Store parcel IDs consistently in uppercase
    },
    ownerDetails: { // Embedded document for owner information
        ownerName: { type: String, required: true },
        idNumber: { type: String, required: true, unique: false }, // ID number of the owner
        contact: { type: String },
        address: { type: String }
    },
    // GeoJSON Polygon structure for geospatial data (MongoDB standard)
    // For geospatial queries, MongoDB requires `type` and `coordinates` fields.
    geometry: {
        type: {
            type: String, // Must be 'Polygon' for polygon data
            enum: ['Polygon'], // Restrict to Polygon type
            required: true
        },
        // Coordinates for a Polygon: an array of arrays of numbers.
        // E.g., [[ [lon1, lat1], [lon2, lat2], ... ]] for a single exterior ring.
        // The first and last coordinate pair MUST be identical to close the polygon.
        coordinates: {
            type: [[[Number]]], // Array of arrays of arrays of numbers (for GeoJSON Polygon)
            required: true
            // Custom validation for GeoJSON Polygon structure can be added here or in route validation
        }
    },
    documents: { // Array of strings to store file paths/URLs of uploaded documents
        type: [String],
        default: [] // Default to an empty array if no documents
    },
    status: {
        type: String,
        enum: ['pending_verification', 'verified', 'disputed', 'registered'], // Predefined statuses
        default: 'pending_verification' // Initial status for new parcels
    },
    registeredBy: { // Reference to the User who registered this parcel
        type: mongoose.Schema.Types.ObjectId, // Stores the ObjectId of the User document
        ref: 'User', // Specifies that this references the 'User' model
        required: true // A parcel must be registered by a user
    }
}, {
    timestamps: true, // Mongoose automatically manages `createdAt` and `updatedAt`
    collection: 'parcels' // <--- ADDED THIS LINE to explicitly set collection name
});

// --- Mongoose Indexes ---
// Crucial for enabling efficient geospatial queries on the `geometry` field.
// '2dsphere' index supports queries on Earth-like spheres and allows various geospatial operators.
LandParcelSchema.index({ geometry: '2dsphere' });

module.exports = mongoose.model('LandParcel', LandParcelSchema);
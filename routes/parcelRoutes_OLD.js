// dloms_project/backend/routes/parcelRoutes.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const LandParcel = require('../models/LandParcel'); // LandParcel model
const { protect, authorize } = require('../middleware/authMiddleware'); // Auth and authorization middleware
const upload = require('../utils/fileUpload'); // Multer file upload utility
const path = require('path');
const fs = require('fs'); // Node.js built-in file system for deleting files

// Helper for basic GeoJSON Polygon validation
const isGeoJSONPolygon = (value) => {
    try {
        const geojson = typeof value === 'string' ? JSON.parse(value) : value;
        if (geojson.type !== 'Polygon' || !Array.isArray(geojson.coordinates) || geojson.coordinates.length === 0) {
            throw new Error('Geometry must be a GeoJSON Polygon object with coordinates.');
        }
        const outerRing = geojson.coordinates[0]; // Assuming at least one linear ring (outer)
        if (!Array.isArray(outerRing) || outerRing.length < 4) {
            throw new Error('Polygon exterior ring must have at least 4 coordinate pairs.');
        }
        // Check if the polygon is closed (first and last coordinate pair are identical)
        if (outerRing[0][0] !== outerRing[outerRing.length - 1][0] || outerRing[0][1] !== outerRing[outerRing.length - 1][1]) {
            throw new Error('Polygon exterior ring must be closed (first and last coordinate must be identical).');
        }
        return true;
    } catch (e) {
        throw new Error(`Invalid GeoJSON Polygon format: ${e.message}`);
    }
};

// @route   POST /api/parcels
// @desc    Create a new land parcel with associated documents
// @access  Private (Accessible by 'field_officer' and 'admin' roles)
// @comment FRONTEND API INTEGRATION POINT:
//          Frontend's parcel registration form (e.g., in `ParcelRegistration.js` from prior frontend overview)
//          will POST `multipart/form-data` to this endpoint.
//          Ensure `Content-Type: multipart/form-data` in frontend `axios.post` call,
//          and pass data as `FormData` object (e.g., `formData.append('parcelId', '...')`, `formData.append('documents', file)`).
router.post(
    '/',
    protect, // Authenticate user first
    authorize('field_officer', 'admin'), // Only field officers and admins can create parcels
    upload.array('documents', 10), // 'documents' is the field name for files; allows up to 10 files
    [
        // Validation for text fields (req.body)
        body('parcelId').trim().notEmpty().withMessage('Parcel ID is required').custom(async (value) => {
            const existingParcel = await LandParcel.findOne({ parcelId: value });
            if (existingParcel) {
                return Promise.reject('Parcel with this ID already exists');
            }
        }),
        body('ownerDetails').notEmpty().withMessage('Owner details are required').isJSON().withMessage('Owner details must be a valid JSON string'),
        body('geometry').notEmpty().withMessage('Geometry is required').isJSON().withMessage('Geometry must be a valid JSON string').custom((value, { req }) => {
            // Validate and parse geometry, store it on req for easy access
            const parsedGeometry = JSON.parse(value);
            isGeoJSONPolygon(parsedGeometry); // Throws error if invalid
            req.parsedGeometry = parsedGeometry; // Attach parsed object to request
            return true;
        }),
        body('status').optional().isIn(['pending_verification', 'verified', 'disputed', 'registered']).withMessage('Invalid status provided')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            // If validation fails, clean up any uploaded files
            if (req.files && req.files.length > 0) {
                req.files.forEach(file => {
                    fs.unlink(file.path, (err) => {
                        if (err) console.error(`Error deleting temp file ${file.path}:`, err);
                    });
                });
            }
            return res.status(400).json({ errors: errors.array() });
        }

        const { parcelId, ownerDetails, status } = req.body;
        // ownerDetails and geometry come as JSON strings, so parse them
        const parsedOwnerDetails = JSON.parse(ownerDetails);
        const documents = req.files ? req.files.map(file => path.relative(path.join(__dirname, '..'), file.path).replace(/\\/g, '/')) : []; // Store relative path

        try {
            const newParcel = new LandParcel({
                parcelId,
                ownerDetails: parsedOwnerDetails,
                geometry: req.parsedGeometry, // Use the parsed GeoJSON object
                documents,
                status: status || 'pending_verification', // Use provided status or default
                registeredBy: req.user.id // Get user ID from authenticated user in `req.user`
            });

            await newParcel.save();
            res.status(201).json({
                message: 'Land parcel created successfully',
                parcel: newParcel
            });
        } catch (error) {
            console.error('Error creating parcel:', error.message);
            // If DB save fails, clean up uploaded files
            documents.forEach(docPath => {
                const absolutePath = path.join(__dirname, '..', docPath);
                fs.unlink(absolutePath, (err) => {
                    if (err) console.error(`Error deleting uploaded file after DB error ${absolutePath}:`, err);
                });
            });
            res.status(500).json({ message: 'Server error creating parcel' });
        }
    }
);

// @route   GET /api/parcels
// @desc    Get all land parcels (with optional search and filter)
// @access  Private (Accessible by all authenticated users)
// @comment FRONTEND API INTEGRATION POINT:
//          Your frontend's Dashboard or MapView component will call this to fetch all parcels.
//          Example: `api.get('/api/parcels')`
//          For search/filter: `api.get('/api/parcels?search=term&status=verified')`
router.get('/', protect, async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = {};

        // Build query object based on parameters
        if (search) {
            // Case-insensitive search across parcelId, ownerName, and idNumber
            query.$or = [
                { parcelId: { $regex: search, $options: 'i' } },
                { 'ownerDetails.ownerName': { $regex: search, $options: 'i' } },
                { 'ownerDetails.idNumber': { $regex: search, $options: 'i' } }
            ];
        }
        if (status) {
            query.status = status;
        }

        // Fetch parcels, and populate the 'registeredBy' field to get username/role
        const parcels = await LandParcel.find(query).populate('registeredBy', 'username role email');
        res.json(parcels);
    } catch (error) {
        console.error('Error fetching parcels:', error.message);
        res.status(500).json({ message: 'Server error fetching parcels' });
    }
});

// @route   GET /api/parcels/:id
// @desc    Get a single land parcel by its parcelId
// @access  Private (Accessible by all authenticated users)
// @comment FRONTEND API INTEGRATION POINT:
//          Your frontend's ParcelDetails page will call this when a specific parcel is selected.
//          Example: `api.get('/api/parcels/KSM-001-TEST')`
router.get('/:id', protect, async (req, res) => {
    try {
        const parcel = await LandParcel.findOne({ parcelId: req.params.id }).populate('registeredBy', 'username role email');
        if (!parcel) {
            return res.status(404).json({ message: 'Land parcel not found' });
        }
        res.json(parcel);
    } catch (error) {
        console.error('Error fetching single parcel:', error.message);
        res.status(500).json({ message: 'Server error fetching parcel' });
    }
});

// @route   PUT /api/parcels/:id
// @desc    Update an existing land parcel by its parcelId
// @access  Private (Accessible by 'admin', 'verifier', or 'field_officer' for their own parcels)
// @comment FRONTEND API INTEGRATION POINT:
//          Your frontend's ParcelDetails or Edit page will use this to update parcel info.
//          Example: `api.put('/api/parcels/KSM-001-TEST', { ownerDetails: {...}, status: 'verified' })`
//          Send `Content-Type: application/json`
router.put(
    '/:id',
    protect,
    authorize('admin', 'verifier', 'field_officer'), // Allow specific roles
    async (req, res) => {
        const { ownerDetails, geometry, status } = req.body; // Documents not updated via PUT (use separate upload endpoint)

        try {
            const parcel = await LandParcel.findOne({ parcelId: req.params.id });
            if (!parcel) {
                return res.status(404).json({ message: 'Land parcel not found' });
            }

            // Authorization logic: A field officer can only update their *own* registered parcels
            // Unless they are an admin or verifier, who can update any.
            if (req.user.role === 'field_officer' && parcel.registeredBy.toString() !== req.user.id.toString()) {
                return res.status(403).json({ message: 'Not authorized to update this parcel' });
            }

            // Update fields if provided in request body
            if (ownerDetails) {
                // Ensure ownerDetails is parsed if sent as string, or handled as object
                parcel.ownerDetails = typeof ownerDetails === 'string' ? JSON.parse(ownerDetails) : ownerDetails;
            }
            if (geometry) {
                // Validate and update geometry
                const parsedGeometry = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
                isGeoJSONPolygon(parsedGeometry); // Validate
                parcel.geometry = parsedGeometry;
            }
            if (status) {
                // Restrict status changes: only 'admin' or 'verifier' can set to 'verified'/'disputed'
                if ((status === 'verified' || status === 'disputed') && !['admin', 'verifier'].includes(req.user.role)) {
                    return res.status(403).json({ message: `Only admin or verifier can change parcel status to '${status}'` });
                }
                parcel.status = status;
            }

            parcel.updatedAt = Date.now(); // Update the timestamp

            await parcel.save(); // Save changes
            res.json({
                message: 'Land parcel updated successfully',
                parcel
            });
        } catch (error) {
            console.error('Error updating parcel:', error.message);
            res.status(500).json({ message: 'Server error updating parcel', details: error.message });
        }
    }
);

// @route   DELETE /api/parcels/:id
// @desc    Delete a land parcel by its parcelId
// @access  Private (Accessible by 'admin' role only)
// @comment FRONTEND API INTEGRATION POINT:
//          Your frontend's Admin panel or ParcelDetails page (with confirmation) will call this.
//          Example: `api.delete('/api/parcels/KSM-001-TEST')`
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const parcel = await LandParcel.findOne({ parcelId: req.params.id });
        if (!parcel) {
            return res.status(404).json({ message: 'Land parcel not found' });
        }

        // --- Important: Delete associated files from the file system ---
        parcel.documents.forEach(docPath => {
            const absolutePath = path.join(__dirname, '..', docPath); // Construct absolute path
            fs.unlink(absolutePath, (err) => {
                if (err) console.error(`Failed to delete file ${absolutePath}:`, err.message);
            });
        });

        await parcel.deleteOne(); // Use deleteOne() for Mongoose v6+
        res.json({ message: 'Land parcel and associated documents deleted successfully' });
    } catch (error) {
        console.error('Error deleting parcel:', error.message);
        res.status(500).json({ message: 'Server error deleting parcel' });
    }
});

// @route   POST /api/parcels/:id/documents
// @desc    Add new documents to an existing parcel
// @access  Private (Accessible by 'field_officer', 'admin', 'verifier')
// @comment FRONTEND API INTEGRATION POINT:
//          Frontend's ParcelDetails page (e.g., a "Add Documents" section) will use this.
//          Send `multipart/form-data` with `new_documents` as the field name.
//          Example: `api.post('/api/parcels/KSM-001-TEST/documents', formData)`
router.post(
    '/:id/documents',
    protect,
    authorize('field_officer', 'admin', 'verifier'),
    upload.array('new_documents', 5), // Field name for files, max 5 new documents
    async (req, res) => {
        // Check if files were actually uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No documents provided for upload' });
        }

        try {
            const parcel = await LandParcel.findOne({ parcelId: req.params.id });
            if (!parcel) {
                // If parcel not found, delete uploaded files to prevent orphaned files
                req.files.forEach(file => {
                    fs.unlink(file.path, (err) => {
                        if (err) console.error(`Error deleting temp file ${file.path}:`, err);
                    });
                });
                return res.status(404).json({ message: 'Land parcel not found' });
            }

            // Get paths of newly uploaded files
            const newDocPaths = req.files.map(file => path.relative(path.join(__dirname, '..'), file.path).replace(/\\/g, '/'));

            // Add new document paths to the existing documents array
            parcel.documents.push(...newDocPaths);
            parcel.updatedAt = Date.now(); // Update timestamp

            await parcel.save(); // Save the updated parcel

            res.json({
                message: 'Documents added successfully',
                parcel: parcel // Return the updated parcel object
            });
        } catch (error) {
            console.error('Error adding documents:', error.message);
            // If DB save fails (e.g., validation error), clean up uploaded files
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error(`Error deleting uploaded file after DB error: ${file.path}, Error: ${err}`);
                });
            });
            res.status(500).json({ message: 'Server error adding documents' });
        }
    }
);

// @route   GET /api/parcels/spatial/within-bbox
// @desc    Find parcels within a given bounding box (for map view display)
// @access  Private (Accessible by all authenticated users)
// @comment FRONTEND API INTEGRATION POINT:
//          Your frontend's MapView component will call this when the map moves or zooms,
//          to dynamically load only parcels within the current visible area.
//          Send min/max coordinates as query parameters.
//          Example: `api.get('/api/parcels/spatial/within-bbox?minLon=34.7&minLat=-0.3&maxLon=34.8&maxLat=-0.2')`
router.get('/spatial/within-bbox', protect, async (req, res) => {
    const { minLon, minLat, maxLon, maxLat } = req.query;

    if (!minLon || !minLat || !maxLon || !maxLat) {
        return res.status(400).json({ message: 'Missing bounding box parameters (minLon, minLat, maxLon, maxLat)' });
    }

    // Convert query parameters to numbers
    const [lon1, lat1, lon2, lat2] = [
        parseFloat(minLon), parseFloat(minLat),
        parseFloat(maxLon), parseFloat(maxLat)
    ];

    try {
        // MongoDB $geoWithin with $box operator for rectangular queries
        // $box expects [[lower-left corner], [upper-right corner]]
        const parcels = await LandParcel.find({
            geometry: {
                $geoWithin: {
                    $box: [[lon1, lat1], [lon2, lat2]]
                }
            }
        }).populate('registeredBy', 'username');

        res.json(parcels);
    } catch (error) {
        console.error('Error performing spatial query:', error.message);
        res.status(500).json({ message: 'Server error performing spatial query' });
    }
});

module.exports = router;
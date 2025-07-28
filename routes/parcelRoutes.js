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

// --- CRITICAL CHANGE: SPECIFIC ROUTES GO FIRST ---
// Ensure routes with specific paths like '/spatial/within-bbox' or '/:id/documents'
// are defined BEFORE more general routes like '/:id'.

// @route   GET /api/parcels/spatial/within-bbox
// @desc    Find parcels within a given bounding box (for map view display)
// @access  Private (Accessible by all authenticated users)
router.get('/spatial/within-bbox', protect, async (req, res) => {
    const { minLon, minLat, maxLon, maxLat } = req.query;

    if (!minLon || !minLat || !maxLon || !maxLat) {
        return res.status(400).json({ message: 'Missing bounding box parameters (minLon, minLat, maxLon, maxLat)' });
    }

    const [lon1, lat1, lon2, lat2] = [
        parseFloat(minLon), parseFloat(minLat),
        parseFloat(maxLon), parseFloat(maxLat)
    ];

    try {
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

// @route   POST /api/parcels
// @desc    Create a new land parcel with associated documents
// @access  Private (Accessible by 'field_officer' and 'admin' roles)
router.post(
    '/',
    protect,
    authorize('field_officer', 'admin'),
    upload.array('documents', 10),
    [
        body('parcelId').trim().notEmpty().withMessage('Parcel ID is required').custom(async (value) => {
            const existingParcel = await LandParcel.findOne({ parcelId: value });
            if (existingParcel) {
                return Promise.reject('Parcel with this ID already exists');
            }
        }),
        body('ownerDetails').notEmpty().withMessage('Owner details are required').isJSON().withMessage('Owner details must be a valid JSON string'),
        body('geometry').notEmpty().withMessage('Geometry is required').isJSON().withMessage('Geometry must be a valid JSON string').custom((value, { req }) => {
            const parsedGeometry = JSON.parse(value);
            isGeoJSONPolygon(parsedGeometry);
            req.parsedGeometry = parsedGeometry;
            return true;
        }),
        body('status').optional().isIn(['pending_verification', 'verified', 'disputed', 'registered']).withMessage('Invalid status provided')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
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
        const parsedOwnerDetails = JSON.parse(ownerDetails);
        const documents = req.files ? req.files.map(file => path.relative(path.join(__dirname, '..'), file.path).replace(/\\/g, '/')) : [];

        try {
            const newParcel = new LandParcel({
                parcelId,
                ownerDetails: parsedOwnerDetails,
                geometry: req.parsedGeometry,
                documents,
                status: status || 'pending_verification',
                registeredBy: req.user.id
            });

            await newParcel.save();
            res.status(201).json({
                message: 'Land parcel created successfully',
                parcel: newParcel
            });
        } catch (error) {
            console.error('Error creating parcel:', error.message);
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
router.get('/', protect, async (req, res) => {
    try {
        const { search, status } = req.query;
        let query = {};

        if (search) {
            query.$or = [
                { parcelId: { $regex: search, $options: 'i' } },
                { 'ownerDetails.ownerName': { $regex: search, $options: 'i' } },
                { 'ownerDetails.idNumber': { $regex: search, $options: 'i' } }
            ];
        }
        if (status) {
            query.status = status;
        }

        const parcels = await LandParcel.find(query).populate('registeredBy', 'username role email');
        res.json(parcels);
    } catch (error) {
        console.error('Error fetching parcels:', error.message);
        res.status(500).json({ message: 'Server error fetching parcels' });
    }
});

// @route   POST /api/parcels/:id/documents
// @desc    Add new documents to an existing parcel
// @access  Private (Accessible by 'field_officer', 'admin', 'verifier')
router.post(
    '/:id/documents',
    protect,
    authorize('field_officer', 'admin', 'verifier'),
    upload.array('new_documents', 5),
    async (req, res) => {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No documents provided for upload' });
        }

        try {
            const parcel = await LandParcel.findOne({ parcelId: req.params.id });
            if (!parcel) {
                req.files.forEach(file => {
                    fs.unlink(file.path, (err) => {
                        if (err) console.error(`Error deleting temp file ${file.path}:`, err);
                    });
                });
                return res.status(404).json({ message: 'Land parcel not found' });
            }

            const newDocPaths = req.files.map(file => path.relative(path.join(__dirname, '..'), file.path).replace(/\\/g, '/'));

            parcel.documents.push(...newDocPaths);
            parcel.updatedAt = Date.now();

            await parcel.save();

            res.json({
                message: 'Documents added successfully',
                parcel: parcel
            });
        } catch (error) {
            console.error('Error adding documents:', error.message);
            req.files.forEach(file => {
                fs.unlink(file.path, (err) => {
                    if (err) console.error(`Error deleting uploaded file after DB error: ${file.path}, Error: ${err}`);
                });
            });
            res.status(500).json({ message: 'Server error adding documents' });
        }
    }
);

// @route   GET /api/parcels/:id
// @desc    Get a single land parcel by its parcelId
// @access  Private (Accessible by all authenticated users)
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
router.put(
    '/:id',
    protect,
    authorize('admin', 'verifier', 'field_officer'),
    async (req, res) => {
        const { ownerDetails, geometry, status } = req.body;

        try {
            const parcel = await LandParcel.findOne({ parcelId: req.params.id });
            if (!parcel) {
                return res.status(404).json({ message: 'Land parcel not found' });
            }

            if (req.user.role === 'field_officer' && parcel.registeredBy.toString() !== req.user.id.toString()) {
                return res.status(403).json({ message: 'Not authorized to update this parcel' });
            }

            if (ownerDetails) {
                parcel.ownerDetails = typeof ownerDetails === 'string' ? JSON.parse(ownerDetails) : ownerDetails;
            }
            if (geometry) {
                const parsedGeometry = typeof geometry === 'string' ? JSON.parse(geometry) : geometry;
                isGeoJSONPolygon(parsedGeometry);
                parcel.geometry = parsedGeometry;
            }
            if (status) {
                if ((status === 'verified' || status === 'disputed') && !['admin', 'verifier'].includes(req.user.role)) {
                    return res.status(403).json({ message: `Only admin or verifier can change parcel status to '${status}'` });
                }
                parcel.status = status;
            }

            parcel.updatedAt = Date.now();

            await parcel.save();
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
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
    try {
        const parcel = await LandParcel.findOne({ parcelId: req.params.id });
        if (!parcel) {
            return res.status(404).json({ message: 'Land parcel not found' });
        }

        parcel.documents.forEach(docPath => {
            const absolutePath = path.join(__dirname, '..', docPath);
            fs.unlink(absolutePath, (err) => {
                if (err) console.error(`Failed to delete file ${absolutePath}:`, err.message);
            });
        });

        await parcel.deleteOne();
        res.json({ message: 'Land parcel and associated documents deleted successfully' });
    } catch (error) {
            console.error('Error deleting parcel:', error.message);
            res.status(500).json({ message: 'Server error deleting parcel' });
        }
    }
);

module.exports = router;
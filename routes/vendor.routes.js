const router = require('express').Router();
const {
    getAllVendors,
    getApprovedVendors,
    getPendingVendors,
    getVendorDetails,
    getIndividualVendors,
    getApprovedIndividuals,
    getPendingIndividuals
} = require('../controllers/vendorController');

const authenticate = require('../middlewares/authMiddleware');
const { permit } = require('../middlewares/roleMiddleware');

// Public routes - Get vendor lists
router.get('/list', getAllVendors);
router.get('/approved', getApprovedVendors);
router.get('/pending', getPendingVendors);
router.get('/individuals', getIndividualVendors);
router.get('/individuals/approved', getApprovedIndividuals);
router.get('/individuals/pending', getPendingIndividuals);

// Authenticated routes - Get vendor details
router.get('/details/:vendor_id', authenticate, getVendorDetails);

module.exports = router;

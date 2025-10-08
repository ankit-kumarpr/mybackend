const router = require('express').Router();
const {
    addService,
    getVendorServices,
    getServiceDetails,
    updateService,
    deleteService,
    searchServices,
    getKeywordSuggestions,
    testEndpoint
} = require('../controllers/serviceController');

const authenticate = require('../middlewares/authMiddleware');
const { permit } = require('../middlewares/roleMiddleware');
const { 
    uploadServiceImages, 
    handleMulterError 
} = require('../middlewares/uploadMiddleware');

// Vendor routes for service management
router.post('/add', authenticate, permit('vendor'), uploadServiceImages, handleMulterError, addService);
router.get('/list', authenticate, permit('vendor'), getVendorServices);
router.get('/detail/:service_id', authenticate, permit('vendor'), getServiceDetails);
router.put('/update/:service_id', authenticate, permit('vendor'), uploadServiceImages, handleMulterError, updateService);
router.delete('/delete/:service_id', authenticate, permit('vendor'), deleteService);

// Public routes for searching services
router.get('/search', searchServices);

// Keyword suggestions route (public - no authentication required)
router.post('/suggest-keywords', getKeywordSuggestions);

// Test route
router.get('/test', testEndpoint);

module.exports = router;

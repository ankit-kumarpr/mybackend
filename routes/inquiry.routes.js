const router = require('express').Router();
const {
    submitInquiry,
    getVendorInquiries,
    getIndividualInquiries,
    updateInquiryResponse,
    getInquiryDetails,
    getUserLocation,
    acceptInquiry,
    rejectInquiry,
    verifyPayment,
    getLeadPricing
} = require('../controllers/inquiryController');

const authenticate = require('../middlewares/authMiddleware');
const { permit } = require('../middlewares/roleMiddleware');

// Public routes
router.get('/location', getUserLocation);
router.get('/pricing', getLeadPricing);

// Authenticated routes
router.post('/submit', authenticate, submitInquiry);

// Vendor routes for inquiry management
router.get('/vendor/list', authenticate, permit('vendor'), getVendorInquiries);
router.get('/vendor/details/:inquiry_id', authenticate, permit('vendor'), getInquiryDetails);
router.put('/vendor/response/:inquiry_id', authenticate, permit('vendor'), updateInquiryResponse);
router.post('/vendor/accept/:inquiry_id', authenticate, permit('vendor'), acceptInquiry);
router.post('/vendor/reject/:inquiry_id', authenticate, permit('vendor'), rejectInquiry);
router.post('/vendor/verify-payment/:inquiry_id', authenticate, permit('vendor'), verifyPayment);

// Individual routes for inquiry management
router.get('/individual/list', authenticate, getIndividualInquiries);
router.get('/individual/details/:inquiry_id', authenticate, getInquiryDetails);
router.put('/individual/response/:inquiry_id', authenticate, updateInquiryResponse);
router.post('/individual/accept/:inquiry_id', authenticate, acceptInquiry);
router.post('/individual/reject/:inquiry_id', authenticate, rejectInquiry);
router.post('/individual/verify-payment/:inquiry_id', authenticate, verifyPayment);

module.exports = router;

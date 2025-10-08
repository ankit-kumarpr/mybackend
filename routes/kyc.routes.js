const router = require('express').Router();
const {
    submitCompleteKyc,
    getKycStatus,
    getAllKycApplications,
    getKycApplication,
    approveKyc,
    rejectKyc,
    updateKyc,
    fixIndividualKycCompletion,
    syncUserKycStatus
} = require('../controllers/kycController');

const authenticate = require('../middlewares/authMiddleware');
const { permit } = require('../middlewares/roleMiddleware');
const { 
    uploadCompleteKyc, 
    handleMulterError 
} = require('../middlewares/uploadMiddleware');

// Vendor and Individual routes (authenticated vendors and individuals only)
router.post('/submit', authenticate, permit('vendor', 'individual'), uploadCompleteKyc, handleMulterError, submitCompleteKyc);
router.get('/status', authenticate, permit('vendor', 'individual'), getKycStatus);
router.put('/update', authenticate, permit('vendor', 'individual'), uploadCompleteKyc, handleMulterError, updateKyc);

// Admin routes (admin, super_admin, sales_person)
router.get('/applications', authenticate, permit('admin', 'super_admin', 'sales_person'), getAllKycApplications);
router.get('/application/:kyc_id', authenticate, permit('admin', 'super_admin', 'sales_person'), getKycApplication);
router.put('/approve/:kyc_id', authenticate, permit('admin', 'super_admin', 'sales_person'), approveKyc);
router.put('/reject/:kyc_id', authenticate, permit('admin', 'super_admin', 'sales_person'), rejectKyc);

// Utility routes for admin maintenance
router.post('/fix-individual-completion', authenticate, permit('admin', 'super_admin'), fixIndividualKycCompletion);
router.post('/sync-user-kyc-status', authenticate, permit('admin', 'super_admin'), syncUserKycStatus);

module.exports = router;

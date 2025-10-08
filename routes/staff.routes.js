const router = require('express').Router();
const {
    addStaff,
    getVendorStaff,
    removeStaff,
    getStaffDetails,
    searchIndividuals
} = require('../controllers/staffController');

const authenticate = require('../middlewares/authMiddleware');
const { permit } = require('../middlewares/roleMiddleware');

// Vendor routes for staff management
router.post('/addstaff', authenticate, permit('vendor'), addStaff);
router.get('/list', authenticate, permit('vendor'), getVendorStaff);
router.get('/search-individuals',  searchIndividuals);
router.get('/details/:staff_id', authenticate, permit('vendor'), getStaffDetails);
router.put('/remove/:staff_id', authenticate, permit('vendor'), removeStaff);

module.exports = router;

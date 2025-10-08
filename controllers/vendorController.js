const User = require('../models/User');
const VendorKyc = require('../models/vendorKyc');
const VendorCategory = require('../models/vendorcategory');

// Get all vendors (both approved and pending)
const getAllVendors = async (req, res) => {
    try {
        const { page = 1, limit = 10, role = 'vendor' } = req.query;
        const skip = (page - 1) * limit;

        // Get vendors with KYC status
        const vendors = await User.find({ 
            role: role,
            active: true 
        })
        .select('name email phone customId role createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        // Get KYC details for each vendor
        const vendorsWithKyc = await Promise.all(
            vendors.map(async (vendor) => {
                const kycDetails = await VendorKyc.findOne({ 
                    vendor_id: vendor._id 
                }).populate('business_details.category', 'category_name category_description category_image')
                .select('kyc_status submitted_at approval_details business_details');

                let shopInfo = null;
                if (kycDetails && kycDetails.business_details) {
                    shopInfo = {
                        shop_name: kycDetails.business_details.shop_name,
                        shop_photo: kycDetails.business_details.shop_photo,
                        category: kycDetails.business_details.category ? {
                            _id: kycDetails.business_details.category._id,
                            category_name: kycDetails.business_details.category.category_name,
                            category_description: kycDetails.business_details.category.category_description,
                            category_image: kycDetails.business_details.category.category_image
                        } : null
                    };
                }

                return {
                    ...vendor.toObject(),
                    kyc_status: kycDetails ? kycDetails.kyc_status : 'not_submitted',
                    submitted_at: kycDetails ? kycDetails.submitted_at : null,
                    approval_details: kycDetails ? kycDetails.approval_details : null,
                    shop_info: shopInfo
                };
            })
        );

        const totalCount = await User.countDocuments({ 
            role: role,
            active: true 
        });

        res.status(200).json({
            success: true,
            message: `${role}s fetched successfully`,
            data: vendorsWithKyc,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalCount / limit),
                total_count: totalCount,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching vendors:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching vendors',
            error: error.message
        });
    }
};

// Get only approved vendors
const getApprovedVendors = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Get vendors with approved KYC
        const approvedKyc = await VendorKyc.find({ 
            kyc_status: 'approved',
            user_role: 'vendor'
        })
        .populate('vendor_id', 'name email phone customId role createdAt')
        .populate('business_details.category', 'category_name category_description category_image')
        .select('vendor_id kyc_status submitted_at approval_details business_details')
        .sort({ submitted_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        const vendorsWithKyc = approvedKyc.map(kyc => {
            let shopInfo = null;
            if (kyc.business_details) {
                shopInfo = {
                    shop_name: kyc.business_details.shop_name,
                    shop_photo: kyc.business_details.shop_photo,
                    category: kyc.business_details.category ? {
                        _id: kyc.business_details.category._id,
                        category_name: kyc.business_details.category.category_name,
                        category_description: kyc.business_details.category.category_description,
                        category_image: kyc.business_details.category.category_image
                    } : null
                };
            }

            return {
                ...kyc.vendor_id.toObject(),
                kyc_status: kyc.kyc_status,
                submitted_at: kyc.submitted_at,
                approval_details: kyc.approval_details,
                shop_info: shopInfo
            };
        });

        const totalCount = await VendorKyc.countDocuments({ 
            kyc_status: 'approved',
            user_role: 'vendor'
        });

        res.status(200).json({
            success: true,
            message: 'Approved vendors fetched successfully',
            data: vendorsWithKyc,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalCount / limit),
                total_count: totalCount,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching approved vendors:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching approved vendors',
            error: error.message
        });
    }
};

// Get only pending vendors (registered but KYC not approved)
const getPendingVendors = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Get vendors with pending or rejected KYC
        const pendingKyc = await VendorKyc.find({ 
            kyc_status: { $in: ['pending', 'rejected'] },
            user_role: 'vendor'
        })
        .populate('vendor_id', 'name email phone customId role createdAt')
        .populate('business_details.category', 'category_name category_description category_image')
        .select('vendor_id kyc_status submitted_at approval_details business_details')
        .sort({ submitted_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        const vendorsWithKyc = pendingKyc.map(kyc => {
            let shopInfo = null;
            if (kyc.business_details) {
                shopInfo = {
                    shop_name: kyc.business_details.shop_name,
                    shop_photo: kyc.business_details.shop_photo,
                    category: kyc.business_details.category ? {
                        _id: kyc.business_details.category._id,
                        category_name: kyc.business_details.category.category_name,
                        category_description: kyc.business_details.category.category_description,
                        category_image: kyc.business_details.category.category_image
                    } : null
                };
            }

            return {
                ...kyc.vendor_id.toObject(),
                kyc_status: kyc.kyc_status,
                submitted_at: kyc.submitted_at,
                approval_details: kyc.approval_details,
                shop_info: shopInfo
            };
        });

        const totalCount = await VendorKyc.countDocuments({ 
            kyc_status: { $in: ['pending', 'rejected'] },
            user_role: 'vendor'
        });

        res.status(200).json({
            success: true,
            message: 'Pending vendors fetched successfully',
            data: vendorsWithKyc,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalCount / limit),
                total_count: totalCount,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching pending vendors:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending vendors',
            error: error.message
        });
    }
};

// Get all individuals
const getIndividualVendors = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Get individuals with KYC status
        const individuals = await User.find({ 
            role: 'individual',
            active: true 
        })
        .select('name email phone customId role createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        // Get KYC details for each individual
        const individualsWithKyc = await Promise.all(
            individuals.map(async (individual) => {
                const kycDetails = await VendorKyc.findOne({ 
                    vendor_id: individual._id 
                }).select('kyc_status submitted_at approval_details');

                return {
                    ...individual.toObject(),
                    kyc_status: kycDetails ? kycDetails.kyc_status : 'not_submitted',
                    submitted_at: kycDetails ? kycDetails.submitted_at : null,
                    approval_details: kycDetails ? kycDetails.approval_details : null
                };
            })
        );

        const totalCount = await User.countDocuments({ 
            role: 'individual',
            active: true 
        });

        res.status(200).json({
            success: true,
            message: 'Individuals fetched successfully',
            data: individualsWithKyc,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalCount / limit),
                total_count: totalCount,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching individuals:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching individuals',
            error: error.message
        });
    }
};

// Get only approved individuals
const getApprovedIndividuals = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Get individuals with approved KYC
        const approvedKyc = await VendorKyc.find({ 
            kyc_status: 'approved',
            user_role: 'individual'
        })
        .populate('vendor_id', 'name email phone customId role createdAt')
        .select('vendor_id kyc_status submitted_at approval_details')
        .sort({ submitted_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        const individualsWithKyc = approvedKyc.map(kyc => ({
            ...kyc.vendor_id.toObject(),
            kyc_status: kyc.kyc_status,
            submitted_at: kyc.submitted_at,
            approval_details: kyc.approval_details
        }));

        const totalCount = await VendorKyc.countDocuments({ 
            kyc_status: 'approved',
            user_role: 'individual'
        });

        res.status(200).json({
            success: true,
            message: 'Approved individuals fetched successfully',
            data: individualsWithKyc,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalCount / limit),
                total_count: totalCount,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching approved individuals:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching approved individuals',
            error: error.message
        });
    }
};

// Get only pending individuals (registered but KYC not approved)
const getPendingIndividuals = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Get individuals with pending or rejected KYC
        const pendingKyc = await VendorKyc.find({ 
            kyc_status: { $in: ['pending', 'rejected'] },
            user_role: 'individual'
        })
        .populate('vendor_id', 'name email phone customId role createdAt')
        .select('vendor_id kyc_status submitted_at approval_details')
        .sort({ submitted_at: -1 })
        .skip(skip)
        .limit(parseInt(limit));

        const individualsWithKyc = pendingKyc.map(kyc => ({
            ...kyc.vendor_id.toObject(),
            kyc_status: kyc.kyc_status,
            submitted_at: kyc.submitted_at,
            approval_details: kyc.approval_details
        }));

        const totalCount = await VendorKyc.countDocuments({ 
            kyc_status: { $in: ['pending', 'rejected'] },
            user_role: 'individual'
        });

        res.status(200).json({
            success: true,
            message: 'Pending individuals fetched successfully',
            data: individualsWithKyc,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalCount / limit),
                total_count: totalCount,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error fetching pending individuals:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending individuals',
            error: error.message
        });
    }
};

// Get detailed vendor information
const getVendorDetails = async (req, res) => {
    try {
        const { vendor_id } = req.params;

        // Get vendor details
        const vendor = await User.findById(vendor_id)
            .select('name email phone customId role createdAt active');

        if (!vendor) {
            return res.status(404).json({
                success: false,
                message: 'Vendor not found'
            });
        }

        // Get KYC details
        const kycDetails = await VendorKyc.findOne({ 
            vendor_id: vendor_id 
        }).populate('business_details.category', 'category_name category_description category_image');

        let shopInfo = null;
        if (kycDetails && kycDetails.business_details) {
            shopInfo = {
                shop_name: kycDetails.business_details.shop_name,
                shop_photo: kycDetails.business_details.shop_photo,
                category: kycDetails.business_details.category ? {
                    _id: kycDetails.business_details.category._id,
                    category_name: kycDetails.business_details.category.category_name,
                    category_description: kycDetails.business_details.category.category_description,
                    category_image: kycDetails.business_details.category.category_image
                } : null
            };
        }

        const vendorWithKyc = {
            ...vendor.toObject(),
            kyc_details: kycDetails || null,
            shop_info: shopInfo
        };

        res.status(200).json({
            success: true,
            message: 'Vendor details fetched successfully',
            data: vendorWithKyc
        });

    } catch (error) {
        console.error('Error fetching vendor details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching vendor details',
            error: error.message
        });
    }
};

module.exports = {
    getAllVendors,
    getApprovedVendors,
    getPendingVendors,
    getVendorDetails,
    getIndividualVendors,
    getApprovedIndividuals,
    getPendingIndividuals
};

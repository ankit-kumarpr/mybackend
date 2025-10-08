const Staff = require('../models/Staff');
const User = require('../models/User');
const VendorKyc = require('../models/vendorKyc');
const mongoose = require('mongoose');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};


// Add individual as staff (only existing individuals with approved KYC)
const addStaff = async (req, res) => {
    try {
        const vendorId = req.user._id;
        
        // Validate vendor role
        if (req.user.role !== 'vendor') {
            return res.status(403).json({
                success: false,
                message: 'Only vendors can add staff members'
            });
        }

        const { customId, name, notes } = req.body;

        // Validate required fields
        if (!customId || !name) {
            return res.status(400).json({
                success: false,
                message: 'Both customId and name are required'
            });
        }

        // Find the individual user by customId
        const individualUser = await User.findOne({ 
            customId: customId.trim(),
            role: 'individual'
        });

        if (!individualUser) {
            return res.status(404).json({
                success: false,
                message: 'Individual not found with the provided customId'
            });
        }

        // Verify the name matches
        if (individualUser.name.toLowerCase() !== name.toLowerCase().trim()) {
            return res.status(400).json({
                success: false,
                message: 'Name does not match with the provided customId'
            });
        }

        // Check if individual has approved KYC
        const kycRecord = await VendorKyc.findOne({
            vendor_id: individualUser._id,
            kyc_status: 'approved'
        });

        if (!kycRecord) {
            return res.status(400).json({
                success: false,
                message: 'Individual must have approved KYC to be added as staff'
            });
        }

        // Check if individual is already staff of this vendor
        const existingStaff = await Staff.findOne({
            vendor_id: vendorId,
            individual_user_id: individualUser._id,
            status: { $ne: 'removed' }
        });

        if (existingStaff) {
            return res.status(400).json({
                success: false,
                message: 'This individual is already a staff member'
            });
        }

        // Check if individual is staff of any other vendor
        const otherVendorStaff = await Staff.findOne({
            individual_user_id: individualUser._id,
            status: 'active',
            vendor_id: { $ne: vendorId }
        });

        if (otherVendorStaff) {
            return res.status(400).json({
                success: false,
                message: 'This individual is already working with another vendor'
            });
        }

        // Create staff record
        const staffData = {
            vendor_id: vendorId,
            individual_user_id: individualUser._id,
            notes: notes ? notes.trim() : ''
        };

        const staff = new Staff(staffData);
        
        // Ensure staff_custom_id is generated before saving
        if (!staff.staff_custom_id) {
            try {
                // Get vendor details
                const vendor = await User.findById(vendorId);
                if (!vendor) {
                    return res.status(400).json({
                        success: false,
                        message: 'Vendor not found'
                    });
                }

                // Get vendor's shop name from KYC
                const vendorKyc = await VendorKyc.findOne({ vendor_id: vendorId });
                
                let shopName = 'shop';
                if (vendorKyc && vendorKyc.business_details && vendorKyc.business_details.shop_name) {
                    shopName = vendorKyc.business_details.shop_name;
                }

                // Get individual user details
                const individualUserDetails = await User.findById(individualUser._id);
                const staffName = individualUserDetails.name;

                // Clean names for custom ID generation
                const cleanShopName = shopName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 6);
                const cleanStaffName = staffName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 6);
                
                // Generate random number
                const randomNumber = Math.floor(1000 + Math.random() * 9000);
                
                // Create custom ID format: staff + shopname + staffname + randomnumber
                let staffCustomId = `staff${cleanShopName}${cleanStaffName}${randomNumber}`;
                
                // Ensure uniqueness
                let isUnique = false;
                let attempts = 0;
                const maxAttempts = 10;
                
                while (!isUnique && attempts < maxAttempts) {
                    const existingStaff = await Staff.findOne({ staff_custom_id: staffCustomId });
                    if (!existingStaff) {
                        isUnique = true;
                    } else {
                        staffCustomId = `staff${cleanShopName}${cleanStaffName}${Math.floor(1000 + Math.random() * 9000)}`;
                        attempts++;
                    }
                }
                
                if (!isUnique) {
                    return res.status(500).json({
                        success: false,
                        message: 'Unable to generate unique staff custom ID'
                    });
                }
                
                staff.staff_custom_id = staffCustomId;
            } catch (error) {
                console.error('Error generating staff custom ID in controller:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Error generating staff custom ID',
                    error: error.message
                });
            }
        }
        
        await staff.save();

        // Populate the individual user details
        await staff.populate('individual_user_id', 'name email phone customId');

        res.status(201).json({
            success: true,
            message: 'Individual added as staff successfully',
            data: {
                staff_id: staff._id,
                staff_custom_id: staff.staff_custom_id,
                individual_id: individualUser._id,
                individual_customId: individualUser.customId,
                name: individualUser.name,
                email: individualUser.email,
                phone: individualUser.phone,
                status: staff.status,
                assigned_at: staff.assigned_at
            }
        });

    } catch (error) {
        console.error('Add staff error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get all staff members for a vendor
const getVendorStaff = async (req, res) => {
    try {
        const vendorId = req.user._id;
        
        // Validate vendor role
        if (req.user.role !== 'vendor') {
            return res.status(403).json({
                success: false,
                message: 'Only vendors can view their staff'
            });
        }

        const { status = 'active', page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = { vendor_id: vendorId };
        if (status !== 'all') {
            query.status = status;
        }

        // Get staff members with pagination
        const staff = await Staff.find(query)
            .populate('individual_user_id', 'name email phone customId')
            .sort({ assigned_at: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count
        const totalCount = await Staff.countDocuments(query);

        // Get KYC details for all staff members
        const staffWithKyc = await Promise.all(
            staff.map(async (staffMember) => {
                const individualKyc = await VendorKyc.findOne({
                    vendor_id: staffMember.individual_user_id._id,
                    user_role: 'individual'
                });

                return {
                    staff_id: staffMember._id,
                    staff_custom_id: staffMember.staff_custom_id,
                    individual_id: staffMember.individual_user_id._id,
                    individual_customId: staffMember.individual_user_id.customId,
                    name: staffMember.individual_user_id.name,
                    email: staffMember.individual_user_id.email,
                    phone: staffMember.individual_user_id.phone,
                    status: staffMember.status,
                    assigned_at: staffMember.assigned_at,
                    notes: staffMember.notes,
                    // Add KYC details if available
                    aadhar_number: individualKyc?.personal_details?.aadhar_number || null,
                    profile_image: individualKyc?.personal_details?.profile_photo || null,
                    address: individualKyc?.personal_details?.personal_address || null,
                    kyc_status: individualKyc?.kyc_status || null
                };
            })
        );

        res.status(200).json({
            success: true,
            message: 'Staff members retrieved successfully',
            data: {
                staff: staffWithKyc,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(totalCount / limit),
                    total_count: totalCount,
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get vendor staff error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Remove staff member
const removeStaff = async (req, res) => {
    try {
        const vendorId = req.user._id;
        const { staff_id } = req.params;
        const { removal_reason } = req.body;

        // Validate vendor role
        if (req.user.role !== 'vendor') {
            return res.status(403).json({
                success: false,
                message: 'Only vendors can remove staff members'
            });
        }

        // Validate staff_id
        if (!isValidObjectId(staff_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid staff ID'
            });
        }

        // Find staff member
        const staff = await Staff.findOne({
            _id: staff_id,
            vendor_id: vendorId
        }).populate('individual_user_id', 'name email customId');

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }

        // Check if already removed
        if (staff.status === 'removed') {
            return res.status(400).json({
                success: false,
                message: 'Staff member is already removed'
            });
        }

        // Update staff status
        staff.status = 'removed';
        staff.removed_at = new Date();
        staff.removed_by = vendorId;
        staff.removal_reason = removal_reason ? removal_reason.trim() : '';

        await staff.save();

        // Prepare response data
        let responseData = {
            staff_id: staff._id,
            staff_custom_id: staff.staff_custom_id,
            individual_id: staff.individual_user_id._id,
            individual_customId: staff.individual_user_id.customId,
            name: staff.individual_user_id.name,
            email: staff.individual_user_id.email,
            status: staff.status,
            removed_at: staff.removed_at,
            removal_reason: staff.removal_reason
        };

        res.status(200).json({
            success: true,
            message: 'Staff member removed successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Remove staff error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get staff member details
const getStaffDetails = async (req, res) => {
    try {
        const vendorId = req.user._id;
        const { staff_id } = req.params;

        // Validate vendor role
        if (req.user.role !== 'vendor') {
            return res.status(403).json({
                success: false,
                message: 'Only vendors can view staff details'
            });
        }

        // Validate staff_id
        if (!isValidObjectId(staff_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid staff ID'
            });
        }

        // Find staff member
        const staff = await Staff.findOne({
            _id: staff_id,
            vendor_id: vendorId
        }).populate('individual_user_id', 'name email phone customId');

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found'
            });
        }

        // Get individual's KYC details for address and other info
        const individualKyc = await VendorKyc.findOne({
            vendor_id: staff.individual_user_id._id,
            user_role: 'individual'
        });

        // Format response data
        let responseData = {
            staff_id: staff._id,
            staff_custom_id: staff.staff_custom_id,
            individual_id: staff.individual_user_id._id,
            individual_customId: staff.individual_user_id.customId,
            name: staff.individual_user_id.name,
            email: staff.individual_user_id.email,
            phone: staff.individual_user_id.phone,
            status: staff.status,
            assigned_at: staff.assigned_at,
            notes: staff.notes
        };

        // Add KYC details if available
        if (individualKyc && individualKyc.personal_details) {
            responseData.aadhar_number = individualKyc.personal_details.aadhar_number;
            responseData.profile_image = individualKyc.personal_details.profile_photo;
            responseData.address = individualKyc.personal_details.personal_address;
            responseData.kyc_status = individualKyc.kyc_status;
            responseData.kyc_approved_at = individualKyc.approval_details?.approved_at;
        }

        if (staff.status === 'removed') {
            responseData.removed_at = staff.removed_at;
            responseData.removal_reason = staff.removal_reason;
        }

        res.status(200).json({
            success: true,
            message: 'Staff details retrieved successfully',
            data: responseData
        });

    } catch (error) {
        console.error('Get staff details error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Search individuals by customId or name (for adding existing individuals)
const searchIndividuals = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters long'
            });
        }

        const searchTerm = query.trim();

        // Search by customId or name
        const individuals = await User.find({
            role: 'individual',
            $or: [
                { customId: { $regex: searchTerm, $options: 'i' } },
                { name: { $regex: searchTerm, $options: 'i' } }
            ]
        })
        .select('name email phone customId')
        .limit(10);

        // Check KYC status for each individual
        const individualsWithKyc = await Promise.all(
            individuals.map(async (individual) => {
                const kycRecord = await VendorKyc.findOne({
                    vendor_id: individual._id,
                    kyc_status: 'approved'
                });

                return {
                    individual_id: individual._id,
                    customId: individual.customId,
                    name: individual.name,
                    email: individual.email,
                    phone: individual.phone,
                    kyc_approved: !!kycRecord
                };
            })
        );

        res.status(200).json({
            success: true,
            message: 'Individuals found',
            data: {
                individuals: individualsWithKyc,
                count: individualsWithKyc.length
            }
        });

    } catch (error) {
        console.error('Search individuals error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    addStaff,
    getVendorStaff,
    removeStaff,
    getStaffDetails,
    searchIndividuals
};

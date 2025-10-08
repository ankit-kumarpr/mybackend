const VendorKyc = require('../models/vendorKyc');
const User = require('../models/User');
const VendorCategory = require('../models/vendorcategory');
const mongoose = require('mongoose');
const { sendMail, kycSubmissionTemplate, kycApprovalTemplate, kycRejectionTemplate } = require('../services/emailService');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

// Helper function to validate GST number
const isValidGST = (gstNumber) => {
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gstNumber);
};

// Helper function to validate Aadhar number
const isValidAadhar = (aadharNumber) => {
    const aadharRegex = /^[0-9]{12}$/;
    return aadharRegex.test(aadharNumber);
};

// Helper function to validate Pincode
const isValidPincode = (pincode) => {
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    return pincodeRegex.test(pincode);
};

// Helper function to safely parse JSON strings
const safeParseJSON = (jsonString, fieldName) => {
    if (typeof jsonString !== 'string') {
        return jsonString; // Already an object
    }
    
    try {
        // Clean the string - remove any extra whitespace and potential hidden characters
        const cleaned = jsonString.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
        return JSON.parse(cleaned);
    } catch (error) {
        console.error(`JSON Parse Error for ${fieldName}:`, error.message);
        console.error(`Raw value:`, jsonString);
        throw new Error(`Invalid JSON format in ${fieldName}: ${error.message}`);
    }
};

// Submit Complete KYC (All data in one request)
const submitCompleteKyc = async (req, res) => {
    try {
        const vendorId = req.user._id;
        let { 
            aadhar_number,
            personal_address, 
            shop_name, 
            category, 
            gst_number, 
            business_address, 
            duration 
        } = req.body;

        // Parse JSON strings if they are strings
        try {
            personal_address = safeParseJSON(personal_address, 'personal_address');
            business_address = safeParseJSON(business_address, 'business_address');
        } catch (parseError) {
            return res.status(400).json({
                success: false,
                message: parseError.message
            });
        }

        // Check if user exists and has vendor or individual role
        const user = await User.findById(vendorId);
        if (!user || !['vendor', 'individual'].includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: "Only vendors and individual users can submit KYC"
            });
        }

        const userRole = user.role;

        // Check if KYC already exists and is not approved
        const existingKyc = await VendorKyc.findOne({ vendor_id: vendorId });
        if (existingKyc && existingKyc.kyc_status === 'approved') {
            return res.status(400).json({
                success: false,
                message: "KYC is already approved. Cannot resubmit."
            });
        }

        // Validate Aadhar number
        if (!aadhar_number || !isValidAadhar(aadhar_number)) {
            return res.status(400).json({
                success: false,
                message: "Valid 12-digit Aadhar number is required"
            });
        }

        // Validate files based on user role
        if (!req.files || 
            !req.files.aadhar_card_image || 
            !req.files.profile_photo || 
            !req.files.video_kyc) {
            return res.status(400).json({
                success: false,
                message: "Aadhar card image, profile photo, and video KYC are required"
            });
        }

        // For vendors, shop photo is also required
        if (userRole === 'vendor' && !req.files.shop_photo) {
            return res.status(400).json({
                success: false,
                message: "Shop photo is required for vendors"
            });
        }

        // Validate required fields based on user role
        if (!personal_address || !duration) {
            return res.status(400).json({
                success: false,
                message: "Personal address and video duration are required"
            });
        }

        // For vendors, additional fields are required
        if (userRole === 'vendor' && (!shop_name || !category || !business_address)) {
            return res.status(400).json({
                success: false,
                message: "Shop name, category, and business address are required for vendors"
            });
        }

        // Validate personal address
        const { street_address, city, state, pincode, landmark } = personal_address;
        if (!street_address || !city || !state || !pincode) {
            return res.status(400).json({
                success: false,
                message: "Street address, city, state, and pincode are required in personal address"
            });
        }

        if (!isValidPincode(pincode)) {
            return res.status(400).json({
                success: false,
                message: "Invalid personal address pincode format"
            });
        }

        // Validate category ID (only for vendors)
        if (userRole === 'vendor') {
            if (!isValidObjectId(category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category ID"
                });
            }

            // Check if category exists
            const categoryExists = await VendorCategory.findById(category);
            if (!categoryExists) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }
        }

        // Validate GST number if provided
        if (gst_number && !isValidGST(gst_number)) {
            return res.status(400).json({
                success: false,
                message: "Invalid GST number format"
            });
        }

        // Extract business address variables (only for vendors)
        let busStreet, busCity, busState, country, busPincode, busLandmark;
        if (userRole === 'vendor') {
            const businessAddressData = business_address;
            busStreet = businessAddressData.street_address;
            busCity = businessAddressData.city;
            busState = businessAddressData.state;
            country = businessAddressData.country;
            busPincode = businessAddressData.pincode;
            busLandmark = businessAddressData.landmark;

            // Validate business address
            if (!busStreet || !busCity || !busState || !country || !busPincode) {
                return res.status(400).json({
                    success: false,
                    message: "Street address, city, state, country, and pincode are required in business address"
                });
            }

            if (!isValidPincode(busPincode)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid business address pincode format"
                });
            }
        }

        // Validate video duration (15-20 seconds)
        if (duration < 15 || duration > 20) {
            return res.status(400).json({
                success: false,
                message: "Video duration must be between 15 and 20 seconds"
            });
        }

        // Get uploaded file names
        const aadhar_card_image = req.files.aadhar_card_image[0].filename;
        const profile_photo = req.files.profile_photo[0].filename;
        const video_url = req.files.video_kyc[0].filename;
        
        // Shop photo only for vendors
        let shop_photo = null;
        if (userRole === 'vendor' && req.files.shop_photo) {
            shop_photo = req.files.shop_photo[0].filename;
        }

        // Create or update KYC record
        let kyc;
        if (existingKyc) {
            // Update existing KYC
            kyc = existingKyc;
        } else {
            // Generate custom ID for new KYC
            const userName = user.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 6);
            const businessName = userRole === 'vendor' ? 
                shop_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 6) : 
                'indiv';
            const randomNumber = Math.floor(1000 + Math.random() * 9000);
            
            let customId = `kyc${userName}${businessName}${randomNumber}`;
            
            // Ensure uniqueness
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!isUnique && attempts < maxAttempts) {
                const existingKycWithId = await VendorKyc.findOne({ customId });
                if (!existingKycWithId) {
                    isUnique = true;
                } else {
                    customId = `kyc${vendorName}${shopName}${Math.floor(1000 + Math.random() * 9000)}`;
                    attempts++;
                }
            }
            
            if (!isUnique) {
                return res.status(500).json({
                    success: false,
                    message: "Unable to generate unique custom ID"
                });
            }
            
            // Create new KYC record with customId
            kyc = new VendorKyc({
                vendor_id: vendorId,
                user_role: userRole,
                customId: customId
            });
        }

        // Set all KYC data
        kyc.personal_details = {
            aadhar_number: aadhar_number.trim(),
            aadhar_card_image: `/uploads/kyc/${aadhar_card_image}`,
            profile_photo: `/uploads/kyc/${profile_photo}`,
            personal_address: {
                street_address: street_address.trim(),
                city: city.trim(),
                state: state.trim(),
                pincode: pincode.trim(),
                landmark: landmark ? landmark.trim() : undefined
            }
        };

        // Set business details only for vendors
        if (userRole === 'vendor') {
            kyc.business_details = {
                shop_name: shop_name.trim(),
                category,
                gst_number: gst_number ? gst_number.trim() : undefined,
                business_address: {
                    street_address: busStreet.trim(),
                    city: busCity.trim(),
                    state: busState.trim(),
                    country: country.trim(),
                    pincode: busPincode.trim(),
                    landmark: busLandmark ? busLandmark.trim() : undefined
                },
                shop_photo: `/uploads/kyc/${shop_photo}`
            };
        }

        kyc.video_kyc = {
            video_url: `/uploads/kyc/${video_url}`,
            duration
        };

        // Mark sections as completed based on user role
        kyc.completion_status = {
            personal_details: true,
            business_details: userRole === 'vendor',
            video_kyc: true
        };

        kyc.submitted_at = new Date();
        kyc.kyc_status = 'pending';

        await kyc.save();

        // Update User model with KYC submission status
        await User.findByIdAndUpdate(vendorId, {
            kycStatus: 'pending',
            kycSubmittedAt: new Date(),
            kycRejectionReason: null // Clear any previous rejection reason
        });

        // Send confirmation email
        const personalAddress = `${kyc.personal_details.personal_address.street_address}, ${kyc.personal_details.personal_address.city}, ${kyc.personal_details.personal_address.state} - ${kyc.personal_details.personal_address.pincode}`;
        
        let businessDetails = '';
        if (userRole === 'vendor' && kyc.business_details) {
            businessDetails = `${kyc.business_details.shop_name} (${kyc.business_details.business_address.city}, ${kyc.business_details.business_address.state})`;
        }

        try {
            await sendMail({
                to: user.email,
                subject: 'KYC Submission Confirmation - Gnet E-commerce',
                html: kycSubmissionTemplate({
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    personalAddress,
                    businessDetails
                })
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail the request if email fails
        }

        return res.status(201).json({
            success: true,
            message: "KYC submitted successfully! Your application is now under review.",
            data: {
                customId: kyc.customId,
                kyc_status: kyc.kyc_status,
                submitted_at: kyc.submitted_at,
                completion_status: kyc.completion_status,
                is_completed: kyc.is_completed
            }
        });

    } catch (error) {
        console.error('Error in submitCompleteKyc:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


// Get KYC Status (for vendor)
const getKycStatus = async (req, res) => {
    try {
        const vendorId = req.user._id;

        const kyc = await VendorKyc.findOne({ vendor_id: vendorId })
            .populate('business_details.category', 'category_name')
            .select('-__v');

        if (!kyc) {
            return res.status(404).json({
                success: false,
                message: "KYC not found. Please start your KYC process."
            });
        }

        return res.status(200).json({
            success: true,
            message: "KYC status retrieved successfully",
            data: kyc
        });

    } catch (error) {
        console.error('Error in getKycStatus:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get All KYC Applications (for admin/super_admin/sales_person)
const getAllKycApplications = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;
        
        // Build query
        const query = {};
        if (status && ['pending', 'approved', 'rejected'].includes(status)) {
            query.kyc_status = status;
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const kycApplications = await VendorKyc.find(query)
            .populate('vendor_id', 'name email phone customId')
            .populate('business_details.category', 'category_name')
            .populate('approval_details.approved_by', 'name email')
            .select('-__v')
            .sort({ submitted_at: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCount = await VendorKyc.countDocuments(query);

        return res.status(200).json({
            success: true,
            message: "KYC applications retrieved successfully",
            data: kycApplications,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalCount / parseInt(limit)),
                total_count: totalCount,
                limit: parseInt(limit)
            }
        });

    } catch (error) {
        console.error('Error in getAllKycApplications:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get Single KYC Application (for admin/super_admin/sales_person)
const getKycApplication = async (req, res) => {
    try {
        const { kyc_id } = req.params;

        if (!isValidObjectId(kyc_id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid KYC ID"
            });
        }

        const kyc = await VendorKyc.findById(kyc_id)
            .populate('vendor_id', 'name email phone customId')
            .populate('business_details.category', 'category_name')
            .populate('approval_details.approved_by', 'name email')
            .select('-__v');

        if (!kyc) {
            return res.status(404).json({
                success: false,
                message: "KYC application not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "KYC application retrieved successfully",
            data: kyc
        });

    } catch (error) {
        console.error('Error in getKycApplication:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Approve KYC (for admin/super_admin/sales_person)
const approveKyc = async (req, res) => {
    try {
        const { kyc_id } = req.params;
        const { admin_notes } = req.body;
        const adminId = req.user._id;

        if (!isValidObjectId(kyc_id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid KYC ID"
            });
        }

        const kyc = await VendorKyc.findById(kyc_id)
            .populate('vendor_id', 'name email phone');

        if (!kyc) {
            return res.status(404).json({
                success: false,
                message: "KYC application not found"
            });
        }

        if (kyc.kyc_status === 'approved') {
            return res.status(400).json({
                success: false,
                message: "KYC is already approved"
            });
        }

        // Recalculate completion status for individuals (fix for existing records)
        if (kyc.user_role === 'individual') {
            const { personal_details, video_kyc } = kyc.completion_status;
            console.log('Individual KYC completion check:', {
                personal_details,
                video_kyc,
                current_is_completed: kyc.is_completed
            });
            
            if (personal_details && video_kyc) {
                kyc.is_completed = true;
                console.log('Individual KYC marked as complete');
            } else {
                kyc.is_completed = false;
                console.log('Individual KYC marked as incomplete');
            }
        }

        if (!kyc.is_completed) {
            return res.status(400).json({
                success: false,
                message: "KYC application is not complete"
            });
        }

        // Update KYC status
        kyc.kyc_status = 'approved';
        kyc.approval_details = {
            approved_by: adminId,
            approved_at: new Date(),
            admin_notes: admin_notes ? admin_notes.trim() : undefined
        };

        await kyc.save();

        // Update User model with KYC status
        await User.findByIdAndUpdate(kyc.vendor_id._id, {
            kycStatus: 'approved',
            kycApprovedAt: new Date(),
            kycRejectionReason: null // Clear rejection reason if any
        });

        // Send approval email
        try {
            await sendMail({
                to: kyc.vendor_id.email,
                subject: 'KYC Approved - Welcome to Gnet E-commerce',
                html: kycApprovalTemplate({
                    name: kyc.vendor_id.name,
                    email: kyc.vendor_id.email
                })
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail the request if email fails
        }

        return res.status(200).json({
            success: true,
            message: "KYC approved successfully",
            data: {
                kyc_id: kyc._id,
                vendor_name: kyc.vendor_id.name,
                approved_at: kyc.approval_details.approved_at,
                admin_notes: kyc.approval_details.admin_notes
            }
        });

    } catch (error) {
        console.error('Error in approveKyc:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Reject KYC (for admin/super_admin/sales_person)
const rejectKyc = async (req, res) => {
    try {
        const { kyc_id } = req.params;
        const { rejection_reason, admin_notes } = req.body;
        const adminId = req.user._id;

        if (!isValidObjectId(kyc_id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid KYC ID"
            });
        }

        // Enforce rejection reason and admin notes
        if (!rejection_reason || rejection_reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Rejection reason is required and must be at least 10 characters long"
            });
        }

        if (!admin_notes || admin_notes.trim().length < 5) {
            return res.status(400).json({
                success: false,
                message: "Admin notes are required and must be at least 5 characters long"
            });
        }

        const kyc = await VendorKyc.findById(kyc_id)
            .populate('vendor_id', 'name email phone');

        if (!kyc) {
            return res.status(404).json({
                success: false,
                message: "KYC application not found"
            });
        }

        if (kyc.kyc_status === 'rejected') {
            return res.status(400).json({
                success: false,
                message: "KYC is already rejected"
            });
        }

        // Update KYC status
        kyc.kyc_status = 'rejected';
        kyc.approval_details = {
            approved_by: adminId,
            approved_at: new Date(),
            rejection_reason: rejection_reason.trim(),
            admin_notes: admin_notes ? admin_notes.trim() : undefined
        };

        await kyc.save();

        // Update User model with KYC status
        await User.findByIdAndUpdate(kyc.vendor_id._id, {
            kycStatus: 'rejected',
            kycRejectionReason: rejection_reason.trim(),
            kycApprovedAt: null // Clear approval date if any
        });

        // Send rejection email
        try {
            await sendMail({
                to: kyc.vendor_id.email,
                subject: 'KYC Review Required - Gnet E-commerce',
                html: kycRejectionTemplate({
                    name: kyc.vendor_id.name,
                    email: kyc.vendor_id.email,
                    rejectionReason: rejection_reason.trim()
                })
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail the request if email fails
        }

        return res.status(200).json({
            success: true,
            message: "KYC rejected successfully",
            data: {
                kyc_id: kyc._id,
                vendor_name: kyc.vendor_id.name,
                rejected_at: kyc.approval_details.approved_at,
                rejection_reason: kyc.approval_details.rejection_reason,
                admin_notes: kyc.approval_details.admin_notes
            }
        });

    } catch (error) {
        console.error('Error in rejectKyc:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update KYC (for vendor - only if not approved)
const updateKyc = async (req, res) => {
    try {
        const vendorId = req.user._id;
        const { section, data } = req.body;

        // Check if this is a complete update (no section specified) or section-specific update
        const isCompleteUpdate = !section;
        
        if (!isCompleteUpdate && !['personal_details', 'business_details', 'video_kyc'].includes(section)) {
            return res.status(400).json({
                success: false,
                message: "Valid section is required (personal_details, business_details, or video_kyc) or send complete update data"
            });
        }

        const kyc = await VendorKyc.findOne({ vendor_id: vendorId });

        if (!kyc) {
            return res.status(404).json({
                success: false,
                message: "KYC not found. Please start your KYC process."
            });
        }

        if (kyc.kyc_status === 'approved') {
            return res.status(400).json({
                success: false,
                message: "Cannot update approved KYC. Please contact support."
            });
        }

        // Handle complete update (similar to submitCompleteKyc)
        if (isCompleteUpdate) {
            let { 
                aadhar_number,
                personal_address, 
                shop_name, 
                category, 
                gst_number, 
                business_address, 
                duration 
            } = req.body;

            // Parse JSON strings if they are strings
            try {
                personal_address = safeParseJSON(personal_address, 'personal_address');
                business_address = safeParseJSON(business_address, 'business_address');
            } catch (parseError) {
                return res.status(400).json({
                    success: false,
                    message: parseError.message
                });
            }

            // Get user role
            const user = await User.findById(vendorId);
            const userRole = user.role;

            // Validate Aadhar number
            if (!aadhar_number || !isValidAadhar(aadhar_number)) {
                return res.status(400).json({
                    success: false,
                    message: "Valid 12-digit Aadhar number is required"
                });
            }

            // Validate required fields based on user role
            if (!personal_address || !duration) {
                return res.status(400).json({
                    success: false,
                    message: "Personal address and video duration are required"
                });
            }

            // For vendors, additional fields are required
            if (userRole === 'vendor' && (!shop_name || !category || !business_address)) {
                return res.status(400).json({
                    success: false,
                    message: "Shop name, category, and business address are required for vendors"
                });
            }

            // Validate personal address
            const { street_address, city, state, pincode, landmark } = personal_address;
            if (!street_address || !city || !state || !pincode) {
                return res.status(400).json({
                    success: false,
                    message: "Street address, city, state, and pincode are required in personal address"
                });
            }

            if (!isValidPincode(pincode)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid personal address pincode format"
                });
            }

            // Validate category ID
            if (!isValidObjectId(category)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid category ID"
                });
            }

            // Check if category exists
            const categoryExists = await VendorCategory.findById(category);
            if (!categoryExists) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            // Validate GST number if provided
            if (gst_number && !isValidGST(gst_number)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid GST number format"
                });
            }

            // Extract business address variables (only for vendors)
            let busStreet, busCity, busState, country, busPincode, busLandmark;
            if (userRole === 'vendor') {
                const businessAddressData = business_address;
                busStreet = businessAddressData.street_address;
                busCity = businessAddressData.city;
                busState = businessAddressData.state;
                country = businessAddressData.country;
                busPincode = businessAddressData.pincode;
                busLandmark = businessAddressData.landmark;

                // Validate business address
                if (!busStreet || !busCity || !busState || !country || !busPincode) {
                    return res.status(400).json({
                        success: false,
                        message: "Street address, city, state, country, and pincode are required in business address"
                    });
                }

                if (!isValidPincode(busPincode)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid business address pincode format"
                    });
                }
            }

            // Validate video duration (15-20 seconds)
            if (duration < 15 || duration > 20) {
                return res.status(400).json({
                    success: false,
                    message: "Video duration must be between 15 and 20 seconds"
                });
            }

            // Validate all required files are uploaded
            if (!req.files || 
                !req.files.aadhar_card_image || 
                !req.files.profile_photo || 
                !req.files.shop_photo || 
                !req.files.video_kyc) {
                return res.status(400).json({
                    success: false,
                    message: "All files are required: aadhar card image, profile photo, shop photo, and video KYC"
                });
            }

            // Get uploaded file names
            const aadhar_card_image = req.files.aadhar_card_image[0].filename;
            const profile_photo = req.files.profile_photo[0].filename;
            const shop_photo = req.files.shop_photo[0].filename;
            const video_url = req.files.video_kyc[0].filename;

            // Update all KYC data
            kyc.personal_details = {
                aadhar_number: aadhar_number.trim(),
                aadhar_card_image: `/uploads/kyc/${aadhar_card_image}`,
                profile_photo: `/uploads/kyc/${profile_photo}`,
                personal_address: {
                    street_address: street_address.trim(),
                    city: city.trim(),
                    state: state.trim(),
                    pincode: pincode.trim(),
                    landmark: landmark ? landmark.trim() : undefined
                }
            };

            kyc.business_details = {
                shop_name: shop_name.trim(),
                category,
                gst_number: gst_number ? gst_number.trim() : undefined,
                business_address: {
                    street_address: busStreet.trim(),
                    city: busCity.trim(),
                    state: busState.trim(),
                    country: country.trim(),
                    pincode: busPincode.trim(),
                    landmark: busLandmark ? busLandmark.trim() : undefined
                },
                shop_photo: `/uploads/kyc/${shop_photo}`
            };

            kyc.video_kyc = {
                video_url: `/uploads/kyc/${video_url}`,
                duration
            };

            // Mark all sections as completed
            kyc.completion_status = {
                personal_details: true,
                business_details: true,
                video_kyc: true
            };

            kyc.submitted_at = new Date();
            kyc.kyc_status = 'pending';

            await kyc.save();

            // Update User model with KYC submission status
            await User.findByIdAndUpdate(vendorId, {
                kycStatus: 'pending',
                kycSubmittedAt: new Date(),
                kycRejectionReason: null // Clear any previous rejection reason
            });

            return res.status(200).json({
                success: true,
                message: "KYC updated successfully",
                data: {
                    kyc_id: kyc._id,
                    custom_id: kyc.customId,
                    kyc_status: kyc.kyc_status,
                    updated_at: kyc.submitted_at
                }
            });
        }

        // Update based on section
        switch (section) {
            case 'personal_details':
                // Check if files are uploaded
                if (!req.files || !req.files.aadhar_card_image || !req.files.profile_photo) {
                    return res.status(400).json({
                        success: false,
                        message: "Aadhar card image and profile photo are required"
                    });
                }

                const aadhar_card_image = req.files.aadhar_card_image[0].filename;
                const profile_photo = req.files.profile_photo[0].filename;
                
                let { aadhar_number, personal_address } = data;
                if (!aadhar_number || !personal_address) {
                    return res.status(400).json({
                        success: false,
                        message: "Aadhar number and personal address are required"
                    });
                }

                // Validate Aadhar number
                if (!isValidAadhar(aadhar_number)) {
                    return res.status(400).json({
                        success: false,
                        message: "Valid 12-digit Aadhar number is required"
                    });
                }
                
                // Parse JSON string if it's a string
                try {
                    personal_address = safeParseJSON(personal_address, 'personal_address');
                } catch (parseError) {
                    return res.status(400).json({
                        success: false,
                        message: parseError.message
                    });
                }
                
                const { street_address, city, state, pincode, landmark } = personal_address;
                if (!street_address || !city || !state || !pincode) {
                    return res.status(400).json({
                        success: false,
                        message: "Street address, city, state, and pincode are required"
                    });
                }

                if (!isValidPincode(pincode)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid pincode format"
                    });
                }

                kyc.personal_details = {
                    aadhar_number: aadhar_number.trim(),
                    aadhar_card_image: `/uploads/kyc/${aadhar_card_image}`,
                    profile_photo: `/uploads/kyc/${profile_photo}`,
                    personal_address: {
                        street_address: street_address.trim(),
                        city: city.trim(),
                        state: state.trim(),
                        pincode: pincode.trim(),
                        landmark: landmark ? landmark.trim() : undefined
                    }
                };
                break;

            case 'business_details':
                // Check if shop photo is uploaded
                if (!req.files || !req.files.shop_photo) {
                    return res.status(400).json({
                        success: false,
                        message: "Shop photo is required"
                    });
                }

                const shop_photo = req.files.shop_photo[0].filename;
                
                let { shop_name, category, gst_number, business_address } = data;
                if (!shop_name || !category || !business_address) {
                    return res.status(400).json({
                        success: false,
                        message: "Shop name, category, and business address are required"
                    });
                }
                
                // Parse JSON string if it's a string
                try {
                    business_address = safeParseJSON(business_address, 'business_address');
                } catch (parseError) {
                    return res.status(400).json({
                        success: false,
                        message: parseError.message
                    });
                }

                if (!isValidObjectId(category)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid category ID"
                    });
                }

                const categoryExists = await VendorCategory.findById(category);
                if (!categoryExists) {
                    return res.status(404).json({
                        success: false,
                        message: "Category not found"
                    });
                }

                if (gst_number && !isValidGST(gst_number)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid GST number format"
                    });
                }

                const { street_address: busStreet, city: busCity, state: busState, country, pincode: busPincode, landmark: busLandmark } = business_address;
                if (!busStreet || !busCity || !busState || !country || !busPincode) {
                    return res.status(400).json({
                        success: false,
                        message: "Street address, city, state, country, and pincode are required"
                    });
                }

                if (!isValidPincode(busPincode)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid pincode format"
                    });
                }

                kyc.business_details = {
                    shop_name: shop_name.trim(),
                    category,
                    gst_number: gst_number ? gst_number.trim() : undefined,
                    business_address: {
                        street_address: busStreet.trim(),
                        city: busCity.trim(),
                        state: busState.trim(),
                        country: country.trim(),
                        pincode: busPincode.trim(),
                        landmark: busLandmark ? busLandmark.trim() : undefined
                    },
                    shop_photo: `/uploads/kyc/${shop_photo}`
                };
                break;

            case 'video_kyc':
                // Check if video is uploaded
                if (!req.files || !req.files.video_kyc) {
                    return res.status(400).json({
                        success: false,
                        message: "Video file is required"
                    });
                }

                const video_url = req.files.video_kyc[0].filename;
                
                const { duration } = data;
                if (!duration) {
                    return res.status(400).json({
                        success: false,
                        message: "Video duration is required"
                    });
                }

                if (duration < 15 || duration > 20) {
                    return res.status(400).json({
                        success: false,
                        message: "Video duration must be between 15 and 20 seconds"
                    });
                }

                kyc.video_kyc = {
                    video_url: `/uploads/kyc/${video_url}`,
                    duration
                };
                break;
        }

        await kyc.save();

        return res.status(200).json({
            success: true,
            message: `${section} updated successfully`,
            data: {
                completion_status: kyc.completion_status,
                is_completed: kyc.is_completed
            }
        });

    } catch (error) {
        console.error('Error in updateKyc:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Utility function to fix existing individual KYC completion status
const fixIndividualKycCompletion = async (req, res) => {
    try {
        // Only allow admin/super_admin to run this fix
        if (!['admin', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can run this fix'
            });
        }

        // Find all individual KYC records
        const individualKycs = await VendorKyc.find({ user_role: 'individual' });
        
        let fixedCount = 0;
        let alreadyCorrectCount = 0;

        for (const kyc of individualKycs) {
            const { personal_details, video_kyc } = kyc.completion_status;
            
            if (personal_details && video_kyc) {
                if (!kyc.is_completed) {
                    kyc.is_completed = true;
                    await kyc.save();
                    fixedCount++;
                } else {
                    alreadyCorrectCount++;
                }
            }
        }

        return res.status(200).json({
            success: true,
            message: 'Individual KYC completion status fixed',
            data: {
                total_individual_kycs: individualKycs.length,
                fixed_count: fixedCount,
                already_correct_count: alreadyCorrectCount
            }
        });

    } catch (error) {
        console.error('Error in fixIndividualKycCompletion:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Utility function to sync User model KYC status with VendorKyc records
const syncUserKycStatus = async (req, res) => {
    try {
        // Only allow admin/super_admin to run this sync
        if (!['admin', 'super_admin'].includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Only admin can run this sync'
            });
        }

        // Find all KYC records
        const allKycs = await VendorKyc.find({}).populate('vendor_id', '_id');
        
        let syncedCount = 0;
        let errorCount = 0;

        for (const kyc of allKycs) {
            try {
                const updateData = {
                    kycStatus: kyc.kyc_status,
                    kycSubmittedAt: kyc.submitted_at
                };

                if (kyc.kyc_status === 'approved') {
                    updateData.kycApprovedAt = kyc.approval_details?.approved_at;
                    updateData.kycRejectionReason = null;
                } else if (kyc.kyc_status === 'rejected') {
                    updateData.kycRejectionReason = kyc.approval_details?.rejection_reason;
                    updateData.kycApprovedAt = null;
                }

                await User.findByIdAndUpdate(kyc.vendor_id._id, updateData);
                syncedCount++;
            } catch (error) {
                console.error(`Error syncing KYC ${kyc._id}:`, error);
                errorCount++;
            }
        }

        return res.status(200).json({
            success: true,
            message: 'User KYC status sync completed',
            data: {
                total_kycs: allKycs.length,
                synced_count: syncedCount,
                error_count: errorCount
            }
        });

    } catch (error) {
        console.error('Error in syncUserKycStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

module.exports = {
    submitCompleteKyc,
    getKycStatus,
    getAllKycApplications,
    getKycApplication,
    approveKyc,
    rejectKyc,
    updateKyc,
    fixIndividualKycCompletion,
    syncUserKycStatus
};

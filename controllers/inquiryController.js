const Inquiry = require('../models/Inquiry');
const Service = require('../models/Service');
const User = require('../models/User');
const VendorCategory = require('../models/vendorcategory');
const VendorKyc = require('../models/vendorKyc');
const Staff = require('../models/Staff');
const inquiryNotificationService = require('../services/inquiryNotificationService');
const locationService = require('../services/locationService');
const paymentService = require('../services/paymentService');
const mongoose = require('mongoose');

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

// Submit new inquiry (Authenticated endpoint)
const submitInquiry = async (req, res) => {
    try {
        const { 
            search_query, 
            inquiry_message,
            user_location
        } = req.body;

        // Get user info from authenticated user
        const user = req.user;
        const user_name = user.name;
        const user_email = user.email;
        const user_phone = user.phone;

        // Validate required fields
        if (!search_query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        // Validate and process location if provided
        let processedLocation = null;
        if (user_location) {
            if (user_location.latitude && user_location.longitude) {
                // Validate coordinates
                if (!locationService.validateCoordinates(user_location.latitude, user_location.longitude)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid coordinates provided'
                    });
                }
                
                // Get address from coordinates if not provided
                if (!user_location.address || !user_location.city) {
                    const locationData = await locationService.getLocationFromCoordinates(
                        user_location.latitude, 
                        user_location.longitude
                    );
                    if (locationData) {
                        processedLocation = {
                            latitude: user_location.latitude,
                            longitude: user_location.longitude,
                            address: locationData.address,
                            city: locationData.city,
                            state: locationData.state,
                            country: locationData.country,
                            pincode: locationData.pincode || null
                        };
                    }
                } else {
                    processedLocation = {
                        ...user_location,
                        pincode: user_location.pincode || null
                    };
                }
                
                // Extract pincode from address if not provided
                if (!processedLocation.pincode && processedLocation.address) {
                    const pincodeMatch = processedLocation.address.match(/\b\d{6}\b/);
                    if (pincodeMatch) {
                        processedLocation.pincode = pincodeMatch[0];
                        console.log('Extracted pincode from address:', processedLocation.pincode);
                    } else {
                        console.log('No pincode found in address:', processedLocation.address);
                    }
                }
            }
        }

        // Find relevant vendors and individuals based on search query
        const { relevantVendors, relevantIndividuals } = await findRelevantRecipients(search_query, processedLocation);

        // Create inquiry
        const inquiryData = {
            user_name: user_name.trim(),
            user_email: user_email.trim().toLowerCase(),
            user_phone: user_phone.trim(),
            search_query: search_query.trim(),
            inquiry_message: inquiry_message ? inquiry_message.trim() : '',
            user_location: processedLocation,
            recipients: {
                vendors: relevantVendors.map(vendor => ({
                    vendor_id: vendor._id,
                    vendor_name: vendor.name,
                    business_name: vendor.business_name || vendor.name
                })),
                individuals: relevantIndividuals.map(individual => ({
                    individual_id: individual._id,
                    individual_name: individual.name
                }))
            }
        };

        const inquiry = new Inquiry(inquiryData);
        await inquiry.save();

        // Send real-time notifications to all recipients
        await inquiryNotificationService.sendInquiryNotification(inquiry);

        // Send Socket.IO notifications for real-time updates
        if (global.io) {
            const notification = {
                type: 'new_inquiry',
                data: {
                    inquiry_id: inquiry._id,
                    user_name: inquiry.user_name,
                    user_phone: inquiry.user_phone,
                    search_query: inquiry.search_query,
                    inquiry_message: inquiry.inquiry_message,
                    user_location: inquiry.user_location,
                    created_at: inquiry.createdAt,
                    priority: inquiry.priority
                },
                timestamp: new Date().toISOString()
            };

            // Send to all vendor recipients
            inquiry.recipients.vendors.forEach(vendor => {
                global.io.to(`user_${vendor.vendor_id}`).emit('notification', notification);
            });

            // Send to all individual recipients
            inquiry.recipients.individuals.forEach(individual => {
                global.io.to(`user_${individual.individual_id}`).emit('notification', notification);
            });

            console.log(`📱 Socket.IO notifications sent to ${inquiry.recipients.vendors.length} vendors and ${inquiry.recipients.individuals.length} individuals`);
        }

        res.status(201).json({
            success: true,
            message: 'Inquiry submitted successfully',
            data: {
                inquiry_id: inquiry._id,
                search_query: inquiry.search_query,
                recipients_count: {
                    vendors: inquiry.recipients.vendors.length,
                    individuals: inquiry.recipients.individuals.length,
                    total: inquiry.recipients.vendors.length + inquiry.recipients.individuals.length
                },
                status: inquiry.status,
                created_at: inquiry.createdAt
            }
        });

    } catch (error) {
        console.error('Submit inquiry error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Find relevant vendors and individuals based on search query and location
const findRelevantRecipients = async (searchQuery, userLocation = null) => {
    try {
        const searchQueryLower = searchQuery.toLowerCase();
        const relevantVendors = [];
        const relevantIndividuals = [];
        
        console.log('Search Query:', searchQuery);
        console.log('User Location:', userLocation);
        console.log('User Pincode:', userLocation?.pincode);

        // Extract meaningful words from search query (remove "near me", "near", etc.)
        const meaningfulWords = searchQuery
            .toLowerCase()
            .replace(/\b(near me|near|close to|around|in|at)\b/g, '')
            .trim()
            .split(/\s+/)
            .filter(word => word.length > 2); // Only words longer than 2 characters
        
        console.log('Meaningful words extracted:', meaningfulWords);

        // 1. Find vendors with matching services, categories, and business details
        const vendorQuery = {
            status: 'active',
            $or: []
        };

        // Add matching for each meaningful word
        meaningfulWords.forEach(word => {
            vendorQuery.$or.push(
                { service_name: { $regex: word, $options: 'i' } },
                { keywords: { $regex: word, $options: 'i' } },
                { search_tags: { $regex: word, $options: 'i' } },
                { description: { $regex: word, $options: 'i' } }
            );
        });

        // Also add original search query for exact matches
        vendorQuery.$or.push(
            { service_name: { $regex: searchQuery, $options: 'i' } },
            { keywords: { $regex: searchQuery, $options: 'i' } },
            { search_tags: { $regex: searchQuery, $options: 'i' } },
            { description: { $regex: searchQuery, $options: 'i' } }
        );

        const matchingServices = await Service.find(vendorQuery)
            .populate('vendor_id', 'name email phone role customId')
            .populate('category', 'category_name');

        // Also find vendors by category name directly
        const categoryQuery = {
            $or: []
        };

        // Add matching for each meaningful word
        meaningfulWords.forEach(word => {
            categoryQuery.$or.push(
                { category_name: { $regex: word, $options: 'i' } }
            );
        });

        // Also add original search query
        categoryQuery.$or.push(
            { category_name: { $regex: searchQuery, $options: 'i' } }
        );
        
        const matchingCategories = await VendorCategory.find(categoryQuery);
        const categoryIds = matchingCategories.map(cat => cat._id);
        
        if (categoryIds.length > 0) {
            const servicesByCategory = await Service.find({
                status: 'active',
                category: { $in: categoryIds }
            }).populate('vendor_id', 'name email phone role customId')
              .populate('category', 'category_name');
            
            matchingServices.push(...servicesByCategory);
        }
        
        console.log('Matching services found:', matchingServices.length);
        console.log('Services:', matchingServices.map(s => ({ 
            service_name: s.service_name, 
            vendor_name: s.vendor_id?.name,
            vendor_customId: s.vendor_id?.customId,
            category: s.category?.category_name,
            keywords: s.keywords,
            search_tags: s.search_tags
        })));

        // Extract unique vendors
        const vendorMap = new Map();
        matchingServices.forEach(service => {
            if (service.vendor_id && service.vendor_id.role === 'vendor') {
                vendorMap.set(service.vendor_id._id.toString(), {
                    _id: service.vendor_id._id,
                    name: service.vendor_id.name,
                    email: service.vendor_id.email,
                    phone: service.vendor_id.phone,
                    business_name: service.vendor_id.name // You might want to get this from KYC
                });
            }
        });

        // Also find vendors by business name in KYC
        const vendorKycQuery = {
            user_role: 'vendor',
            $or: []
        };

        // Add matching for each meaningful word
        meaningfulWords.forEach(word => {
            vendorKycQuery.$or.push(
                { 'business_details.shop_name': { $regex: word, $options: 'i' } },
                { 'business_details.business_name': { $regex: word, $options: 'i' } },
                { 'business_details.business_type': { $regex: word, $options: 'i' } }
            );
        });

        // Also add original search query
        vendorKycQuery.$or.push(
            { 'business_details.shop_name': { $regex: searchQuery, $options: 'i' } },
            { 'business_details.business_name': { $regex: searchQuery, $options: 'i' } },
            { 'business_details.business_type': { $regex: searchQuery, $options: 'i' } }
        );

        // Add location-based matching if user location is provided
        if (userLocation) {
            const locationMatches = [];
            
            // Exact location matching
            if (userLocation.city) {
                locationMatches.push(
                    { 'business_details.business_address': { $regex: userLocation.city, $options: 'i' } },
                    { 'business_details.city': { $regex: userLocation.city, $options: 'i' } }
                );
            }
            
            if (userLocation.state) {
                locationMatches.push(
                    { 'business_details.state': { $regex: userLocation.state, $options: 'i' } }
                );
            }
            
            // Pincode-based matching (more flexible)
            if (userLocation.pincode) {
                locationMatches.push(
                    { 'business_details.pincode': { $regex: userLocation.pincode, $options: 'i' } }
                );
                
                // Also search for nearby pincodes (first 3 digits match)
                const pincodePrefix = userLocation.pincode.substring(0, 3);
                locationMatches.push(
                    { 'business_details.pincode': { $regex: `^${pincodePrefix}`, $options: 'i' } }
                );
            }
            
            // Address-based matching (broader)
            if (userLocation.address) {
                const addressParts = userLocation.address.split(',').map(part => part.trim());
                addressParts.forEach(part => {
                    if (part.length > 2) { // Only meaningful parts
                        locationMatches.push(
                            { 'business_details.business_address': { $regex: part, $options: 'i' } }
                        );
                    }
                });
            }
            
            if (locationMatches.length > 0) {
                vendorKycQuery.$or.push(...locationMatches);
            }
        }

        console.log('Vendor KYC Query:', JSON.stringify(vendorKycQuery, null, 2));
        
        const matchingKyc = await VendorKyc.find(vendorKycQuery).populate('vendor_id', 'name email phone role customId');
        
        console.log('Matching KYC records:', matchingKyc.length);
        console.log('KYC Details:', matchingKyc.map(kyc => ({
            vendor_name: kyc.vendor_id?.name,
            business_address: kyc.business_details?.business_address,
            pincode: kyc.business_details?.pincode,
            city: kyc.business_details?.city
        })));
        
        matchingKyc.forEach(kyc => {
            if (kyc.vendor_id && kyc.vendor_id.role === 'vendor') {
                vendorMap.set(kyc.vendor_id._id.toString(), {
                    _id: kyc.vendor_id._id,
                    name: kyc.vendor_id.name,
                    email: kyc.vendor_id.email,
                    phone: kyc.vendor_id.phone,
                    business_name: kyc.business_details?.shop_name || kyc.business_details?.business_name || kyc.vendor_id.name
                });
            }
        });

        relevantVendors.push(...Array.from(vendorMap.values()));

        // 2. Find individuals (users who are not vendors and not staff) with matching profile
        const individualQuery = {
            role: { $in: ['user', 'individual'] },  // Only include users and individuals
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } },
                { email: { $regex: searchQuery, $options: 'i' } },
                { phone: { $regex: searchQuery, $options: 'i' } },
                { customId: { $regex: searchQuery, $options: 'i' } }
            ]
        };

        // Get all staff user IDs to exclude them (only active staff)
        const staffUsers = await Staff.find({ status: 'active' }, 'individual_user_id');
        const staffUserIds = staffUsers.map(staff => staff.individual_user_id);
        console.log('Staff User IDs to exclude:', staffUserIds);

        // Get all vendor IDs to exclude them
        const vendorUsers = await User.find({ role: 'vendor' }, '_id');
        const vendorUserIds = vendorUsers.map(vendor => vendor._id);
        console.log('Vendor User IDs to exclude:', vendorUserIds);

        // Combine all IDs to exclude
        const excludeIds = [...staffUserIds, ...vendorUserIds];
        console.log('All IDs to exclude:', excludeIds);

        if (excludeIds.length > 0) {
            individualQuery._id = { $nin: excludeIds };
        }

        const individuals = await User.find(individualQuery, 'name email phone role customId');
        
        // Also find individuals by KYC details
        const individualKycQuery = {
            user_role: 'individual',
            $or: [
                { 'personal_details.full_name': { $regex: searchQuery, $options: 'i' } },
                { 'personal_details.aadhar_number': { $regex: searchQuery, $options: 'i' } },
                { 'personal_details.personal_address': { $regex: searchQuery, $options: 'i' } }
            ]
        };

        // Add location-based matching for individuals if user location is provided
        if (userLocation) {
            const individualLocationMatches = [];
            
            // Exact location matching
            if (userLocation.city) {
                individualLocationMatches.push(
                    { 'personal_details.personal_address': { $regex: userLocation.city, $options: 'i' } },
                    { 'personal_details.city': { $regex: userLocation.city, $options: 'i' } }
                );
            }
            
            if (userLocation.state) {
                individualLocationMatches.push(
                    { 'personal_details.state': { $regex: userLocation.state, $options: 'i' } }
                );
            }
            
            // Pincode-based matching (more flexible)
            if (userLocation.pincode) {
                individualLocationMatches.push(
                    { 'personal_details.pincode': { $regex: userLocation.pincode, $options: 'i' } }
                );
                
                // Also search for nearby pincodes (first 3 digits match)
                const pincodePrefix = userLocation.pincode.substring(0, 3);
                individualLocationMatches.push(
                    { 'personal_details.pincode': { $regex: `^${pincodePrefix}`, $options: 'i' } }
                );
            }
            
            // Address-based matching (broader)
            if (userLocation.address) {
                const addressParts = userLocation.address.split(',').map(part => part.trim());
                addressParts.forEach(part => {
                    if (part.length > 2) { // Only meaningful parts
                        individualLocationMatches.push(
                            { 'personal_details.personal_address': { $regex: part, $options: 'i' } }
                        );
                    }
                });
            }
            
            if (individualLocationMatches.length > 0) {
                individualKycQuery.$or.push(...individualLocationMatches);
            }
        }

        const matchingIndividualKyc = await VendorKyc.find(individualKycQuery).populate('vendor_id', 'name email phone role customId');
        
        const individualMap = new Map();
        
        // Add users from direct query
        individuals.forEach(user => {
            individualMap.set(user._id.toString(), {
                _id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                customId: user.customId
            });
        });
        
        // Add users from KYC query (if not already added and not excluded)
        matchingIndividualKyc.forEach(kyc => {
            if (kyc.vendor_id && 
                kyc.vendor_id.role === 'individual' && 
                !excludeIds.includes(kyc.vendor_id._id.toString())) {
                individualMap.set(kyc.vendor_id._id.toString(), {
                    _id: kyc.vendor_id._id,
                    name: kyc.vendor_id.name,
                    email: kyc.vendor_id.email,
                    phone: kyc.vendor_id.phone,
                    role: kyc.vendor_id.role,
                    customId: kyc.vendor_id.customId
                });
            }
        });

        console.log('Found individuals:', individualMap.size, Array.from(individualMap.values()).map(ind => ({ 
            name: ind.name, 
            role: ind.role, 
            id: ind._id,
            customId: ind.customId,
            email: ind.email 
        })));

        relevantIndividuals.push(...Array.from(individualMap.values()));

        return { relevantVendors, relevantIndividuals };

    } catch (error) {
        console.error('Find relevant recipients error:', error);
        return { relevantVendors: [], relevantIndividuals: [] };
    }
};

// Get inquiries for vendors (Vendor can see inquiries sent to them)
const getVendorInquiries = async (req, res) => {
    try {
        const vendorId = req.user._id;

        // Validate vendor role
        if (req.user.role !== 'vendor') {
            return res.status(403).json({
                success: false,
                message: 'Only vendors can view their inquiries'
            });
        }

        const { status = 'pending', page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {
            'recipients.vendors.vendor_id': vendorId
        };

        if (status !== 'all') {
            query.status = status;
        }

        // Get inquiries with pagination
        const inquiries = await Inquiry.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count
        const totalCount = await Inquiry.countDocuments(query);

        res.status(200).json({
            success: true,
            message: 'Inquiries retrieved successfully',
            data: {
                inquiries: inquiries,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(totalCount / limit),
                    total_count: totalCount,
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get vendor inquiries error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get inquiries for individuals (Individual can see inquiries sent to them)
const getIndividualInquiries = async (req, res) => {
    try {
        const individualId = req.user._id;

        // Validate individual role (not vendor, not admin)
        if (req.user.role === 'vendor' || req.user.role === 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Only individuals can view their inquiries'
            });
        }

        // Check if user is staff
        const isStaff = await Staff.findOne({ user_id: individualId });
        if (isStaff) {
            return res.status(403).json({
                success: false,
                message: 'Staff members cannot view individual inquiries'
            });
        }

        const { status = 'pending', page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {
            'recipients.individuals.individual_id': individualId
        };

        if (status !== 'all') {
            query.status = status;
        }

        // Get inquiries with pagination
        const inquiries = await Inquiry.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count
        const totalCount = await Inquiry.countDocuments(query);

        res.status(200).json({
            success: true,
            message: 'Inquiries retrieved successfully',
            data: {
                inquiries: inquiries,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: Math.ceil(totalCount / limit),
                    total_count: totalCount,
                    limit: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get individual inquiries error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Update inquiry response status (for vendors and individuals)
const updateInquiryResponse = async (req, res) => {
    try {
        const { inquiry_id } = req.params;
        const { response_status, notes } = req.body;
        const userId = req.user._id;

        // Validate inquiry_id
        if (!isValidObjectId(inquiry_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid inquiry ID'
            });
        }

        // Find inquiry
        const inquiry = await Inquiry.findById(inquiry_id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        // Check if user is a recipient
        let recipientType = null;
        let recipientIndex = -1;

        // Check if user is a vendor recipient
        const vendorIndex = inquiry.recipients.vendors.findIndex(
            vendor => vendor.vendor_id.toString() === userId.toString()
        );

        if (vendorIndex !== -1) {
            recipientType = 'vendor';
            recipientIndex = vendorIndex;
        } else {
            // Check if user is an individual recipient
            const individualIndex = inquiry.recipients.individuals.findIndex(
                individual => individual.individual_id.toString() === userId.toString()
            );

            if (individualIndex !== -1) {
                recipientType = 'individual';
                recipientIndex = individualIndex;
            }
        }

        if (recipientIndex === -1) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to respond to this inquiry'
            });
        }

        // Update response status
        if (recipientType === 'vendor') {
            inquiry.recipients.vendors[recipientIndex].response_status = response_status;
            inquiry.recipients.vendors[recipientIndex].contacted_at = new Date();
        } else {
            inquiry.recipients.individuals[recipientIndex].response_status = response_status;
            inquiry.recipients.individuals[recipientIndex].contacted_at = new Date();
        }

        // Update overall inquiry status if needed
        if (response_status === 'contacted' && inquiry.status === 'pending') {
            inquiry.status = 'contacted';
        }

        await inquiry.save();

        // Send response notification to other recipients
        await inquiryNotificationService.sendResponseNotification(inquiry._id, userId, response_status);

        res.status(200).json({
            success: true,
            message: 'Response status updated successfully',
            data: {
                inquiry_id: inquiry._id,
                response_status: response_status,
                updated_at: inquiry.updatedAt
            }
        });

    } catch (error) {
        console.error('Update inquiry response error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get inquiry details
const getInquiryDetails = async (req, res) => {
    try {
        const { inquiry_id } = req.params;
        const userId = req.user._id;

        // Validate inquiry_id
        if (!isValidObjectId(inquiry_id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid inquiry ID'
            });
        }

        // Find inquiry
        const inquiry = await Inquiry.findById(inquiry_id);

        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        // Check if user is a recipient
        const isVendorRecipient = inquiry.recipients.vendors.some(
            vendor => vendor.vendor_id.toString() === userId.toString()
        );

        const isIndividualRecipient = inquiry.recipients.individuals.some(
            individual => individual.individual_id.toString() === userId.toString()
        );

        if (!isVendorRecipient && !isIndividualRecipient) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view this inquiry'
            });
        }

        // Increment views
        await inquiry.incrementViews();

        res.status(200).json({
            success: true,
            message: 'Inquiry details retrieved successfully',
            data: inquiry
        });

    } catch (error) {
        console.error('Get inquiry details error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Get user's location from IP address (Public endpoint)
const getUserLocation = async (req, res) => {
    try {
        // Get user's IP address
        const userIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
        
        // Remove IPv6 prefix if present
        const cleanIP = userIP.replace(/^::ffff:/, '');
        
        // Get location from IP
        const location = await locationService.getLocationFromIP(cleanIP);
        
        if (location) {
            res.status(200).json({
                success: true,
                message: 'Location retrieved successfully',
                data: {
                    location: location,
                    ip_address: cleanIP
                }
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Unable to determine location from IP address'
            });
        }

    } catch (error) {
        console.error('Get user location error:', error);
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Accept inquiry
const acceptInquiry = async (req, res) => {
    try {
        const { inquiry_id } = req.params;
        const { message } = req.body;
        const userId = req.user._id;

        // Find inquiry
        const inquiry = await Inquiry.findById(inquiry_id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        // Check if user is a recipient
        const isVendorRecipient = inquiry.recipients.vendors.some(v => v.vendor_id.toString() === userId.toString());
        const isIndividualRecipient = inquiry.recipients.individuals.some(i => i.individual_id.toString() === userId.toString());
        
        if (!isVendorRecipient && !isIndividualRecipient) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to respond to this inquiry'
            });
        }

        // Check if user already responded
        const existingResponse = inquiry.responses.find(r => r.responder_id.toString() === userId.toString());
        if (existingResponse) {
            return res.status(400).json({
                success: false,
                message: 'You have already responded to this inquiry'
            });
        }

        // Check if inquiry is within free period (first 60 minutes)
        const inquiryAge = Date.now() - new Date(inquiry.createdAt).getTime();
        const freePeriod = 60 * 60 * 1000; // 60 minutes in milliseconds
        const isFreePeriod = inquiryAge <= freePeriod;

        // Check if inquiry is within paid period (12 hours total)
        const paidPeriod = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
        const isWithinPaidPeriod = inquiryAge <= paidPeriod;

        if (!isWithinPaidPeriod) {
            return res.status(400).json({
                success: false,
                message: 'This inquiry is no longer available for acceptance'
            });
        }

        // If not in free period, create payment order
        if (!isFreePeriod) {
            const paymentOrder = await paymentService.createLeadPaymentOrder(
                userId, 
                inquiry_id, 
                {
                    name: req.user.name,
                    email: req.user.email
                }
            );

            if (!paymentOrder.success) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create payment order',
                    error: paymentOrder.error
                });
            }

            // Add response with pending payment
            inquiry.responses = inquiry.responses || [];
            inquiry.responses.push({
                responder_id: userId,
                response: 'accepted',
                message: message || 'Inquiry accepted',
                responded_at: new Date(),
                payment_status: 'pending',
                payment_id: paymentOrder.order_id
            });

            await inquiry.save();

            res.status(200).json({
                success: true,
                message: 'Payment required to accept this lead',
                data: {
                    inquiry_id: inquiry._id,
                    payment_required: true,
                    payment_order: {
                        order_id: paymentOrder.order_id,
                        amount: paymentOrder.amount,
                        currency: paymentOrder.currency,
                        receipt: paymentOrder.receipt
                    },
                    lead_price: paymentService.getLeadPriceInRupees()
                }
            });

            return;
        }

        // Free period - accept without payment
        inquiry.status = 'accepted';
        inquiry.responses = inquiry.responses || [];
        inquiry.responses.push({
            responder_id: userId,
            response: 'accepted',
            message: message || 'Inquiry accepted',
            responded_at: new Date(),
            payment_status: 'free'
        });

        await inquiry.save();

        // Send real-time notification to other recipients
        if (global.io) {
            const notification = {
                type: 'inquiry_response',
                data: {
                    inquiry_id: inquiry._id,
                    responder_id: userId,
                    responder_name: req.user.name,
                    response: 'accepted',
                    message: message || 'Inquiry accepted',
                    updated_at: new Date(),
                    payment_status: 'free'
                },
                timestamp: new Date().toISOString()
            };

            // Send to all other recipients
            inquiry.recipients.vendors.forEach(vendor => {
                if (vendor.vendor_id.toString() !== userId.toString()) {
                    global.io.to(`user_${vendor.vendor_id}`).emit('notification', notification);
                }
            });

            inquiry.recipients.individuals.forEach(individual => {
                if (individual.individual_id.toString() !== userId.toString()) {
                    global.io.to(`user_${individual.individual_id}`).emit('notification', notification);
                }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Inquiry accepted successfully (Free period)',
            data: {
                inquiry_id: inquiry._id,
                status: inquiry.status,
                response: 'accepted',
                payment_status: 'free'
            }
        });

    } catch (error) {
        console.error('Accept inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Reject inquiry
const rejectInquiry = async (req, res) => {
    try {
        const { inquiry_id } = req.params;
        const { message } = req.body;
        const userId = req.user._id;

        // Find inquiry
        const inquiry = await Inquiry.findById(inquiry_id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        // Check if user is a recipient
        const isVendorRecipient = inquiry.recipients.vendors.some(v => v.vendor_id.toString() === userId.toString());
        const isIndividualRecipient = inquiry.recipients.individuals.some(i => i.individual_id.toString() === userId.toString());
        
        if (!isVendorRecipient && !isIndividualRecipient) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to respond to this inquiry'
            });
        }

        // Update inquiry
        inquiry.status = 'rejected';
        inquiry.responses = inquiry.responses || [];
        inquiry.responses.push({
            responder_id: userId,
            response: 'rejected',
            message: message || 'Inquiry rejected',
            responded_at: new Date()
        });

        await inquiry.save();

        // Send real-time notification to other recipients
        if (global.io) {
            const notification = {
                type: 'inquiry_response',
                data: {
                    inquiry_id: inquiry._id,
                    responder_id: userId,
                    responder_name: req.user.name,
                    response: 'rejected',
                    message: message || 'Inquiry rejected',
                    updated_at: new Date()
                },
                timestamp: new Date().toISOString()
            };

            // Send to all other recipients
            inquiry.recipients.vendors.forEach(vendor => {
                if (vendor.vendor_id.toString() !== userId.toString()) {
                    global.io.to(`user_${vendor.vendor_id}`).emit('notification', notification);
                }
            });

            inquiry.recipients.individuals.forEach(individual => {
                if (individual.individual_id.toString() !== userId.toString()) {
                    global.io.to(`user_${individual.individual_id}`).emit('notification', notification);
                }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Inquiry rejected successfully',
            data: {
                inquiry_id: inquiry._id,
                status: inquiry.status,
                response: 'rejected'
            }
        });

    } catch (error) {
        console.error('Reject inquiry error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Verify payment and complete lead acceptance
const verifyPayment = async (req, res) => {
    try {
        const { inquiry_id } = req.params;
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.user._id;

        // Find inquiry
        const inquiry = await Inquiry.findById(inquiry_id);
        if (!inquiry) {
            return res.status(404).json({
                success: false,
                message: 'Inquiry not found'
            });
        }

        // Find the pending response
        const pendingResponse = inquiry.responses.find(r => 
            r.responder_id.toString() === userId.toString() && 
            r.payment_status === 'pending' &&
            r.payment_id === razorpay_order_id
        );

        if (!pendingResponse) {
            return res.status(400).json({
                success: false,
                message: 'No pending payment found for this inquiry'
            });
        }

        // Verify payment signature
        const paymentData = {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        };

        const verification = paymentService.verifyPaymentSignature(paymentData);
        
        if (!verification.success) {
            return res.status(400).json({
                success: false,
                message: 'Payment verification failed',
                error: verification.error
            });
        }

        // Update response with paid status
        pendingResponse.payment_status = 'paid';
        pendingResponse.payment_id = razorpay_payment_id;
        inquiry.status = 'accepted';

        await inquiry.save();

        // Send real-time notification to other recipients
        if (global.io) {
            const notification = {
                type: 'inquiry_response',
                data: {
                    inquiry_id: inquiry._id,
                    responder_id: userId,
                    responder_name: req.user.name,
                    response: 'accepted',
                    message: pendingResponse.message || 'Inquiry accepted',
                    updated_at: new Date(),
                    payment_status: 'paid',
                    payment_id: razorpay_payment_id
                },
                timestamp: new Date().toISOString()
            };

            // Send to all other recipients
            inquiry.recipients.vendors.forEach(vendor => {
                if (vendor.vendor_id.toString() !== userId.toString()) {
                    global.io.to(`user_${vendor.vendor_id}`).emit('notification', notification);
                }
            });

            inquiry.recipients.individuals.forEach(individual => {
                if (individual.individual_id.toString() !== userId.toString()) {
                    global.io.to(`user_${individual.individual_id}`).emit('notification', notification);
                }
            });
        }

        res.status(200).json({
            success: true,
            message: 'Payment verified and lead accepted successfully',
            data: {
                inquiry_id: inquiry._id,
                status: inquiry.status,
                response: 'accepted',
                payment_status: 'paid',
                payment_id: razorpay_payment_id
            }
        });

    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get lead pricing info
const getLeadPricing = async (req, res) => {
    try {
        res.status(200).json({
            success: true,
            data: {
                lead_price: paymentService.getLeadPriceInRupees(),
                free_period_minutes: 60,
                paid_period_hours: 12,
                currency: 'INR'
            }
        });
    } catch (error) {
        console.error('Get lead pricing error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
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
};

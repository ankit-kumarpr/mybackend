const mongoose = require('mongoose');

const StaffSchema = new mongoose.Schema({
    // Staff custom ID (auto-generated)
    staff_custom_id: {
        type: String,
        unique: true,
        required: false, // Will be set by pre-save middleware
        index: true
    },
    
    // Vendor who owns this staff member
    vendor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Individual user who is assigned as staff
    individual_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Staff status
    status: {
        type: String,
        enum: ['active', 'inactive', 'removed'],
        default: 'active'
    },
    
    // Assignment details
    assigned_at: {
        type: Date,
        default: Date.now
    },
    
    // Removal details (when staff leaves)
    removed_at: {
        type: Date
    },
    
    removed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    removal_reason: {
        type: String,
        trim: true
    },
    
    // Additional notes
    notes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes for better query performance
StaffSchema.index({ status: 1 });
StaffSchema.index({ individual_user_id: 1 });

// Virtual to get staff member name
StaffSchema.virtual('staff_name').get(function() {
    if (this.individual_user_id) {
        // This will be populated when needed
        return this.individual_user_id.name;
    }
    return null;
});

// Virtual to get staff member email
StaffSchema.virtual('staff_email').get(function() {
    if (this.individual_user_id) {
        // This will be populated when needed
        return this.individual_user_id.email;
    }
    return null;
});

// Pre-save middleware to generate staff custom ID and validate individual's KYC status
StaffSchema.pre('save', async function(next) {
    try {
        console.log('Staff pre-save middleware triggered:', {
            isNew: this.isNew,
            staff_custom_id: this.staff_custom_id,
            vendor_id: this.vendor_id,
            individual_user_id: this.individual_user_id
        });

        // Generate staff custom ID if not exists
        if (this.isNew && !this.staff_custom_id) {
            console.log('Generating new staff custom ID...');
            
            try {
                // Get vendor details
                const vendor = await mongoose.model('User').findById(this.vendor_id);
                if (!vendor) {
                    console.log('Vendor not found:', this.vendor_id);
                    return next(new Error('Vendor not found'));
                }
                console.log('Vendor found:', vendor.name);

                // Get vendor's shop name from KYC
                const VendorKyc = mongoose.model('VendorKyc');
                const vendorKyc = await VendorKyc.findOne({ vendor_id: this.vendor_id });
                
                let shopName = 'shop';
                if (vendorKyc && vendorKyc.business_details && vendorKyc.business_details.shop_name) {
                    shopName = vendorKyc.business_details.shop_name;
                }
                console.log('Shop name:', shopName);

                // Get individual user details
                const individualUser = await mongoose.model('User').findById(this.individual_user_id);
                if (!individualUser) {
                    console.log('Individual user not found:', this.individual_user_id);
                    return next(new Error('Individual user not found'));
                }
                console.log('Individual user found:', individualUser.name);

                const staffName = individualUser.name;
                if (!staffName) {
                    return next(new Error('Individual name is required to generate custom ID'));
                }

                // Clean names for custom ID generation
                const cleanShopName = shopName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 6);
                const cleanStaffName = staffName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 6);
                
                console.log('Clean names:', { cleanShopName, cleanStaffName });
                
                // Generate random number
                const randomNumber = Math.floor(1000 + Math.random() * 9000);
                
                // Create custom ID format: staff + shopname + staffname + randomnumber
                let staffCustomId = `staff${cleanShopName}${cleanStaffName}${randomNumber}`;
                
                console.log('Generated staff custom ID:', staffCustomId);
                
                // Ensure uniqueness
                let isUnique = false;
                let attempts = 0;
                const maxAttempts = 10;
                
                while (!isUnique && attempts < maxAttempts) {
                    const existingStaff = await mongoose.model('Staff').findOne({ staff_custom_id: staffCustomId });
                    if (!existingStaff) {
                        isUnique = true;
                    } else {
                        staffCustomId = `staff${cleanShopName}${cleanStaffName}${Math.floor(1000 + Math.random() * 9000)}`;
                        attempts++;
                    }
                }
                
                if (!isUnique) {
                    return next(new Error('Unable to generate unique staff custom ID'));
                }
                
                this.staff_custom_id = staffCustomId;
                console.log('Final staff custom ID set:', this.staff_custom_id);
                
            } catch (error) {
                console.error('Error generating staff custom ID:', error);
                return next(error);
            }
        }

        // Check if the individual has approved KYC
        const VendorKyc = mongoose.model('VendorKyc');
        const kycRecord = await VendorKyc.findOne({
            vendor_id: this.individual_user_id,
            kyc_status: 'approved'
        });
        
        if (!kycRecord) {
            return next(new Error('Individual must have approved KYC to be added as staff'));
        }
        
        // If removing staff, set removed_at
        if (this.isModified('status') && this.status === 'removed' && !this.removed_at) {
            this.removed_at = new Date();
        }
        
        next();
    } catch (error) {
        next(error);
    }
});


module.exports = mongoose.model('Staff', StaffSchema);

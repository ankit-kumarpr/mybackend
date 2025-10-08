const mongoose = require('mongoose');

const InquirySchema = new mongoose.Schema({
    // User who submitted the inquiry
    user_name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    
    user_email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    
    user_phone: {
        type: String,
        required: true,
        trim: true,
        minlength: 10,
        maxlength: 15
    },
    
    // Search query that triggered the inquiry
    search_query: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 200
    },
    
    // Additional inquiry details (optional)
    inquiry_message: {
        type: String,
        trim: true,
        maxlength: 500
    },
    
    // User's current location
    user_location: {
        latitude: {
            type: Number,
            min: -90,
            max: 90
        },
        longitude: {
            type: Number,
            min: -180,
            max: 180
        },
        address: {
            type: String,
            trim: true,
            maxlength: 200
        },
        city: {
            type: String,
            trim: true,
            maxlength: 100
        },
        state: {
            type: String,
            trim: true,
            maxlength: 100
        },
        country: {
            type: String,
            trim: true,
            maxlength: 100
        }
    },
    
    // Inquiry status
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'contacted', 'completed', 'cancelled'],
        default: 'pending'
    },
    
    // Priority level
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    
    // Recipients who received this inquiry
    recipients: {
        vendors: [{
            vendor_id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            vendor_name: String,
            business_name: String,
            contacted_at: Date,
            response_status: {
                type: String,
                enum: ['not_contacted', 'contacted', 'interested', 'not_interested'],
                default: 'not_contacted'
            }
        }],
        individuals: [{
            individual_id: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            individual_name: String,
            contacted_at: Date,
            response_status: {
                type: String,
                enum: ['not_contacted', 'contacted', 'interested', 'not_interested'],
                default: 'not_contacted'
            }
        }]
    },
    
    // Analytics
    views: {
        type: Number,
        default: 0
    },
    
    responses: [{
        responder_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        response: {
            type: String,
            enum: ['accepted', 'rejected'],
            required: true
        },
        message: {
            type: String,
            trim: true,
            maxlength: 500
        },
        responded_at: {
            type: Date,
            default: Date.now
        },
        payment_status: {
            type: String,
            enum: ['free', 'paid', 'pending'],
            default: 'free'
        },
        payment_id: {
            type: String
        }
    }]
}, {
    timestamps: true
});

// Indexes for better query performance
InquirySchema.index({ search_query: 1 });
InquirySchema.index({ status: 1 });
InquirySchema.index({ priority: 1 });
InquirySchema.index({ createdAt: -1 });
InquirySchema.index({ 'recipients.vendors.vendor_id': 1 });
InquirySchema.index({ 'recipients.individuals.individual_id': 1 });

// Pre-save middleware to generate search tags
InquirySchema.pre('save', async function(next) {
    try {
        // Generate search tags from search query
        const searchTags = this.search_query.toLowerCase().split(/\s+/);
        this.search_tags = [...new Set(searchTags.filter(tag => tag.length > 0))];
        next();
    } catch (error) {
        next(error);
    }
});

// Method to increment views
InquirySchema.methods.incrementViews = function() {
    this.views += 1;
    return this.save();
};

// Method to increment responses
InquirySchema.methods.incrementResponses = function() {
    this.responses += 1;
    return this.save();
};

// Method to mark as contacted
InquirySchema.methods.markAsContacted = function() {
    this.status = 'contacted';
    return this.save();
};

// Method to mark as completed
InquirySchema.methods.markAsCompleted = function() {
    this.status = 'completed';
    return this.save();
};

// Virtual for inquiry URL
InquirySchema.virtual('inquiry_url').get(function() {
    return `/inquiries/${this._id}`;
});

module.exports = mongoose.model('Inquiry', InquirySchema);
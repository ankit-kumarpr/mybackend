const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
    // Vendor who owns this service
    vendor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Service basic details
    service_name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    
    price: {
        type: Number,
        required: true,
        min: 0
    },
    
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    
    // Service images (1-10 images)
    images: [{
        type: String, // URL or file path
        required: true
    }],
    
    // Keywords for search and suggestions
    keywords: [{
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 50
    }],
    
    // Service status
    status: {
        type: String,
        enum: ['active', 'inactive', 'draft'],
        default: 'active'
    },
    
    // Service category (from vendor's business category)
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'VendorCategory',
        required: true
    },
    
    // Additional service details
    duration: {
        type: String, // e.g., "30 minutes", "1 hour", "2 days"
        trim: true
    },
    
    availability: {
        type: String,
        enum: ['available', 'unavailable', 'limited'],
        default: 'available'
    },
    
    // SEO and search optimization
    search_tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    
    // Service metrics
    views: {
        type: Number,
        default: 0
    },
    
    bookings: {
        type: Number,
        default: 0
    },
    
    rating: {
        average: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        count: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true
});

// Indexes for better query performance
ServiceSchema.index({ vendor_id: 1, status: 1 });
ServiceSchema.index({ category: 1 });
ServiceSchema.index({ keywords: 1 });
ServiceSchema.index({ search_tags: 1 });
ServiceSchema.index({ 'rating.average': -1 });
ServiceSchema.index({ createdAt: -1 });

// Pre-save middleware to generate search tags
ServiceSchema.pre('save', async function(next) {
    try {
        // Generate search tags from service name and keywords
        const searchTags = [];
        
        // Add service name words
        const serviceWords = this.service_name.toLowerCase().split(/\s+/);
        searchTags.push(...serviceWords);
        
        // Add keyword words
        this.keywords.forEach(keyword => {
            const keywordWords = keyword.toLowerCase().split(/\s+/);
            searchTags.push(...keywordWords);
        });
        
        // Remove duplicates and empty strings
        this.search_tags = [...new Set(searchTags.filter(tag => tag.length > 0))];
        
        next();
    } catch (error) {
        next(error);
    }
});

// Virtual for service URL
ServiceSchema.virtual('service_url').get(function() {
    return `/services/${this._id}`;
});

// Method to increment views
ServiceSchema.methods.incrementViews = function() {
    this.views += 1;
    return this.save();
};

// Method to increment bookings
ServiceSchema.methods.incrementBookings = function() {
    this.bookings += 1;
    return this.save();
};

// Method to update rating
ServiceSchema.methods.updateRating = function(newRating) {
    const totalRating = (this.rating.average * this.rating.count) + newRating;
    this.rating.count += 1;
    this.rating.average = totalRating / this.rating.count;
    return this.save();
};

module.exports = mongoose.model('Service', ServiceSchema);

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
const kycDir = path.join(uploadsDir, 'kyc');
const staffDir = path.join(uploadsDir, 'staff');
const servicesDir = path.join(uploadsDir, 'services');
const categoriesDir = path.join(uploadsDir, 'categories');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(kycDir)) {
    fs.mkdirSync(kycDir, { recursive: true });
}

if (!fs.existsSync(staffDir)) {
    fs.mkdirSync(staffDir, { recursive: true });
}

if (!fs.existsSync(servicesDir)) {
    fs.mkdirSync(servicesDir, { recursive: true });
}

if (!fs.existsSync(categoriesDir)) {
    fs.mkdirSync(categoriesDir, { recursive: true });
}

// Configure storage for KYC files
const kycStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, kycDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension;
        cb(null, fileName);
    }
});

// Configure storage for staff files
const staffStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, staffDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension;
        cb(null, fileName);
    }
});

// Configure storage for service files
const serviceStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, servicesDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension;
        cb(null, fileName);
    }
});

// Configure storage for category files
const categoryStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, categoriesDir);
    },
    filename: function (req, file, cb) {
        // Generate unique filename with timestamp
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const fileExtension = path.extname(file.originalname);
        const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension;
        cb(null, fileName);
    }
});

// File filter for KYC files
const kycFileFilter = (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv'];
    
    if (file.fieldname === 'aadhar_card_image' || file.fieldname === 'profile_photo' || file.fieldname === 'shop_photo') {
        if (allowedImageTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed for photos'), false);
        }
    } else if (file.fieldname === 'video_kyc') {
        if (allowedVideoTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only MP4, AVI, MOV, and WMV videos are allowed'), false);
        }
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

// File filter for staff files
const staffFileFilter = (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (file.fieldname === 'profile_image') {
        if (allowedImageTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed for profile images'), false);
        }
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

// File filter for service files
const serviceFileFilter = (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (file.fieldname === 'images') {
        if (allowedImageTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed for service images'), false);
        }
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

// File filter for category files
const categoryFileFilter = (req, file, cb) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (file.fieldname === 'category_image') {
        if (allowedImageTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed for category images'), false);
        }
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

// Configure multer for KYC files
const kycUpload = multer({
    storage: kycStorage,
    fileFilter: kycFileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 4 // Maximum 4 files per request
    }
});

// Configure multer for service files
const serviceUpload = multer({
    storage: serviceStorage,
    fileFilter: serviceFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit for service images
        files: 10 // Maximum 10 files per request
    }
});

// Configure multer for staff files
const staffUpload = multer({
    storage: staffStorage,
    fileFilter: staffFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit for profile images
        files: 1 // Maximum 1 file per request
    }
});

// Configure multer for category files
const categoryUpload = multer({
    storage: categoryStorage,
    fileFilter: categoryFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit for category images
        files: 1 // Maximum 1 file per request
    }
});

// Specific upload configurations for different KYC sections
const uploadPersonalDetails = kycUpload.fields([
    { name: 'aadhar_card_image', maxCount: 1 },
    { name: 'profile_photo', maxCount: 1 }
]);

const uploadBusinessDetails = kycUpload.fields([
    { name: 'shop_photo', maxCount: 1 }
]);

const uploadVideoKyc = kycUpload.fields([
    { name: 'video_kyc', maxCount: 1 }
]);

// Upload all KYC files at once
const uploadCompleteKyc = kycUpload.fields([
    { name: 'aadhar_card_image', maxCount: 1 },
    { name: 'profile_photo', maxCount: 1 },
    { name: 'shop_photo', maxCount: 1 },
    { name: 'video_kyc', maxCount: 1 }
]);

// Upload service images
const uploadServiceImages = serviceUpload.array('images', 10);

// Upload single file for staff profile image
const uploadSingleFile = (fieldName) => {
    return staffUpload.single(fieldName);
};

// Upload category image
const uploadCategoryImage = categoryUpload.single('category_image');

// Error handling middleware for multer
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 10MB.'
            });
        } else if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                message: 'Too many files uploaded. Maximum 4 files allowed.'
            });
        } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                success: false,
                message: 'Unexpected file field.'
            });
        }
    } else if (error) {
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
    next();
};

module.exports = {
    uploadPersonalDetails,
    uploadBusinessDetails,
    uploadVideoKyc,
    uploadCompleteKyc,
    uploadSingleFile,
    uploadServiceImages,
    uploadCategoryImage,
    handleMulterError
};

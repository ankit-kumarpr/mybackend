const VendorCategory = require('../models/vendorcategory');
const mongoose = require('mongoose');

// Helper function to generate custom ID
const generateCustomId = (categoryName) => {
    const cleanName = categoryName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const randomNumber = Math.floor(1000 + Math.random() * 9000);   
    return `${cleanName}${randomNumber}`;
};

// Helper function to validate MongoDB ObjectId
const isValidObjectId = (id) => {
    return mongoose.Types.ObjectId.isValid(id);
};

const AddNewCategory = async (req, res) => {
    try {    
        const { category_name, category_description } = req.body;
        const category_image = req.file ? req.file.filename : null;

        // Input validation
        if (!category_name || category_name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Category name is required and must be at least 2 characters long"
            });
        }

        // Check if category already exists
        const existingCategory = await VendorCategory.findOne({ 
            category_name: category_name.trim(),
            is_deleted: false 
        });

        if (existingCategory) {
            return res.status(409).json({
                success: false,
                message: "Category with this name already exists"
            });
        }

        // Generate customId
        let customId;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        // Ensure customId is unique
        while (!isUnique && attempts < maxAttempts) {
            customId = generateCustomId(category_name);
            const existingCategoryWithId = await VendorCategory.findOne({ customId });
            if (!existingCategoryWithId) {
                isUnique = true;
            }
            attempts++;
        }

        if (!isUnique) {
            return res.status(500).json({
                success: false,
                message: "Unable to generate unique customId. Please try again."
            });
        }

        const category = new VendorCategory({
            customId,
            category_name: category_name.trim(),
            category_description: category_description ? category_description.trim() : undefined,
            category_image: category_image
        });

        await category.save();

        return res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: category
        });

    } catch (error) {
        console.error('Error in AddNewCategory:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};


// Get all categories
const GetAllCategories = async (req, res) => {
    try {
        const categoriesList = await VendorCategory.find({ is_deleted: false })
            .select('-__v')
            .sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            message: categoriesList.length > 0 ? "Categories fetched successfully" : "No categories found",
            data: categoriesList,
            count: categoriesList.length
        });
    } catch (error) {
        console.error('Error in GetAllCategories:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update category
const UpdateCategorydata = async (req, res) => {
    try {
        const { category_id } = req.params;
        const { category_name, category_description } = req.body;
        const category_image = req.file ? req.file.filename : null;

        // Validate category_id
        if (!category_id || !isValidObjectId(category_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid category ID is required"
            });
        }

        // Input validation
        if (!category_name || category_name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Category name is required and must be at least 2 characters long"
            });
        }

        // Check if category exists and is not deleted
        const existingCategory = await VendorCategory.findOne({ 
            _id: category_id, 
            is_deleted: false 
        });

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        // Check if another category with the same name exists
        const duplicateCategory = await VendorCategory.findOne({ 
            category_name: category_name.trim(),
            is_deleted: false,
            _id: { $ne: category_id }
        });

        if (duplicateCategory) {
            return res.status(409).json({
                success: false,
                message: "Category with this name already exists"
            });
        }

        const updateData = {
            category_name: category_name.trim(),
            category_description: category_description ? category_description.trim() : undefined
        };
        
        // Only update image if a new one is provided
        if (category_image) {
            updateData.category_image = category_image;
        }

        const updatedCategory = await VendorCategory.findByIdAndUpdate(
            category_id,
            updateData,
            { new: true, runValidators: true }
        ).select('-__v');

        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
            data: updatedCategory
        });

    } catch (error) {
        console.error('Error in UpdateCategorydata:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Delete category (soft delete)
const DeleteCategory = async (req, res) => {
    try {
        const { category_id } = req.params;

        // Validate category_id
        if (!category_id || !isValidObjectId(category_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid category ID is required"
            });
        }

        // Check if category exists and is not already deleted
        const existingCategory = await VendorCategory.findOne({ 
            _id: category_id, 
            is_deleted: false 
        });

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found or already deleted"
            });
        }

        const deletedCategory = await VendorCategory.findByIdAndUpdate(
            category_id,
            { is_deleted: true },
            { new: true }
        ).select('-__v');

        return res.status(200).json({
            success: true,
            message: "Category deleted successfully",
            data: deletedCategory
        });

    } catch (error) {
        console.error('Error in DeleteCategory:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get single category by ID
const GetCategoryById = async (req, res) => {
    try {
        const { category_id } = req.params;

        // Validate category_id
        if (!category_id || !isValidObjectId(category_id)) {
            return res.status(400).json({
                success: false,
                message: "Valid category ID is required"
            });
        }

        const category = await VendorCategory.findOne({ 
            _id: category_id, 
            is_deleted: false 
        }).select('-__v');

        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Category fetched successfully",
            data: category
        });

    } catch (error) {
        console.error('Error in GetCategoryById:', error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    AddNewCategory,
    GetAllCategories,
    GetCategoryById,
    UpdateCategorydata,
    DeleteCategory
};
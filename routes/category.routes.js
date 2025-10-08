const router=require('express').Router();
const {AddNewCategory,GetAllCategories,GetCategoryById,UpdateCategorydata,DeleteCategory}=require('../controllers/category.controller');
const authenticate=require('../middlewares/authMiddleware');
const {permit}=require('../middlewares/roleMiddleware');
const {uploadCategoryImage}=require('../middlewares/uploadMiddleware');

// admin routes
router.post('/add-category',authenticate,permit('admin'),uploadCategoryImage,AddNewCategory);
router.get('/get-all-categories',GetAllCategories);
router.get('/get-category/:category_id',authenticate,permit('admin'),GetCategoryById);
router.put('/update-category/:category_id',authenticate,permit('admin'),uploadCategoryImage,UpdateCategorydata);
router.delete('/delete-category/:category_id',authenticate,permit('admin'),DeleteCategory);

module.exports=router;
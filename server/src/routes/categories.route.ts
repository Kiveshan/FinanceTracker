import { Router } from "express";
import { getAllCategories, createCategory, updateCategory, deleteCategory } from "../controllers/categories.controller";


const router = Router()

router.get('/', getAllCategories)
router.post('/', createCategory)
router.patch('/:category_id',updateCategory)
router.delete('/:category_id',deleteCategory)

export default router
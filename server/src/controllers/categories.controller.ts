import { Request, Response } from 'express'
import { query } from '../db'
import {CreateCategoryBody , UpdateCategoryBody }from '../types'



export const getAllCategories = async (req: Request, res: Response) => {
    try{

    const user_id = 1
    const result = await query(`SELECT id , name , type FROM categories WHERE user_id = $1`, [user_id])
    return res.json(result.rows)

    } catch(error){

        console.error('Error retrieving category information:', error)
        res.status(500).json({ error: 'Failed to get category information' })
    }
   
}


export const createCategory = async (req : Request , res:Response) => {
    try{
    const user_id = 1
    const {name , type} : CreateCategoryBody = req.body
    const result = await query (`INSERT INTO categories (user_id, name, type) VALUES($1, $2, $3 ) RETURNING id , name , type`, [user_id, name, type])
    return res.json(result.rows[0])
    } catch(error) {
        console.log('Error creating category:', error)
        res.status(500).json({error : 'Failed to create category'})
    }
}


export const updateCategory = async (req : Request , res:Response) => {
    try{
    const user_id = 1
    const {category_id} = req.params
    const {name , type} : UpdateCategoryBody = req.body
    await query (`UPDATE categories SET name = COALESCE($1,name), type = COALESCE($2,type) WHERE user_id = $3 AND id = $4`, [name, type, user_id, category_id])
    return res.json({message : 'Successfully updated category'})
    } catch (error){
        console.log('Error could not update category:',error)
        res.status(500).json({error : 'Error updating category'})
    }
}


export const deleteCategory = async (req : Request, res : Response) => {
    try{
    const {category_id} = req.params
    await query(`DELETE FROM categories WHERE id = $1`, [category_id])
    res.json({ message: 'Category deleted successfully' })
    }catch(error){
        console.log('Error could not delete category:', error)
        res.status(500).json({error:'Error deleting category'})
    }
}
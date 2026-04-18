import { Router } from 'express'
import { getBudgets, upsertBudget, updateBudget, deleteBudget } from '../controllers/budgets.controller'

const router = Router()

router.get('/',     getBudgets)
router.post('/',    upsertBudget)
router.patch('/:id', updateBudget)
router.delete('/:id', deleteBudget)

export default router

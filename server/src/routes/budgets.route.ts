import { Router } from 'express'
import { getBudgets, upsertBudget, deleteBudget } from '../controllers/budgets.controller'

const router = Router()

router.get('/',      getBudgets)
router.post('/',     upsertBudget)
router.delete('/:id', deleteBudget)

export default router

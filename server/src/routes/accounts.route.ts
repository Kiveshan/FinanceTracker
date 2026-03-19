import { Router } from 'express'
import {
  getAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount
} from '../controllers/accounts.controller'

// LEARNING NOTE: What is a Router?
// Express's Router is a mini application that handles a subset of routes.
// Instead of defining all routes on the main app object in index.ts,
// we create a router per resource (accounts, transactions, etc) and
// mount it at a prefix. This keeps index.ts clean and each route file
// focused on one resource.
const router = Router()

router.get('/',     getAccounts)
router.get('/:id',  getAccountById)
router.post('/',    createAccount)
router.patch('/:id', updateAccount)
router.delete('/:id', deleteAccount)

export default router

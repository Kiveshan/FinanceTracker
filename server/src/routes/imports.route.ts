import { Router } from 'express'
import multer from 'multer'
import { uploadCsv, previewImport, confirmImport } from '../controllers/imports.controller'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

const router = Router()

router.post('/upload',  upload.single('file'), uploadCsv)
router.post('/preview', previewImport)
router.post('/confirm', confirmImport)

export default router

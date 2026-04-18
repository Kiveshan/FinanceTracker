import { Router } from 'express'
import multer from 'multer'
import { uploadCsv, previewImport, confirmImport, getImports, rollbackImport } from '../controllers/imports.controller'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

const router = Router()

router.get('/',          getImports)
router.post('/upload',   upload.single('file'), uploadCsv)
router.post('/preview',  previewImport)
router.post('/confirm',  confirmImport)
router.delete('/:id',    rollbackImport)

export default router

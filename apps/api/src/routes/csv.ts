import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { importInventoryCsv, importInventoryExcel } from '../services/csvImportService';
import { requireCsvUploader } from '../middleware/roleGuard';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const bodySchema = z.object({
  warehouseId: z.string(),
});

router.post('/upload', requireCsvUploader, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV dosyası gerekli' });
    }

    const body = bodySchema.parse(req.body);
    const isExcel =
      req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      req.file.mimetype === 'application/vnd.ms-excel' ||
      req.file.originalname.toLowerCase().endsWith('.xlsx') ||
      req.file.originalname.toLowerCase().endsWith('.xls');

    const importer = isExcel ? importInventoryExcel : importInventoryCsv;

    await importer(req.file.buffer, {
      warehouseId: body.warehouseId,
      createdByUserId: req.currentUser?.id ?? 'system',
    });

    return res.json({ success: true, format: isExcel ? 'excel' : 'csv' });
  } catch (error) {
    return next(error);
  }
});

export default router;

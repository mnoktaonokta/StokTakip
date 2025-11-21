import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { importInventoryCsv } from '../services/csvImportService';
import { requireAdmin } from '../middleware/roleGuard';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const bodySchema = z.object({
  warehouseId: z.string(),
});

router.post('/upload', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'CSV dosyası gerekli' });
    }

    const body = bodySchema.parse(req.body);

    await importInventoryCsv(req.file.buffer, {
      warehouseId: body.warehouseId,
      createdByUserId: req.currentUser?.id ?? 'system',
    });

    return res.json({ success: true });
  } catch (error) {
    return next(error);
  }
});

export default router;

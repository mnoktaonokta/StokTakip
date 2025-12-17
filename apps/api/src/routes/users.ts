import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { clerkAuthMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/users/me -> Şu an giriş yapmış kullanıcının bilgilerini getir
router.get('/me', clerkAuthMiddleware, async (req: any, res) => {
  try {
    // 1. Clerk'ten gelen ID'yi al
    const clerkId = req.auth.userId;

    if (!clerkId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 2. Veritabanından bu kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { externalId: clerkId },
      include: {
        // İhtiyaç varsa ilişkili verileri de çekebiliriz (örn: warehouse)
        mainWarehouse: true, 
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found in database' });
    }

    // 3. Kullanıcıyı gönder
    return res.json(user);
  } catch (error) {
    console.error('User profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
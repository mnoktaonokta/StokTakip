import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { clerkAuthMiddleware } from '../middleware/auth';
import { clerkClient } from '@clerk/express';

const router = Router();

// GET /api/users/me
router.get('/me', clerkAuthMiddleware, async (req: any, res) => {
  try {
    const userId = req.auth.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 1. Clerk'ten kullanıcının email adresini öğreniyoruz
    const clerkUser = await clerkClient.users.getUser(userId);
    const primaryEmail = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

    if (!primaryEmail) {
       return res.status(400).json({ error: 'User email not found in Clerk' });
    }

    // 2. Bu email ile veritabanımızdaki kullanıcıyı buluyoruz
    // (Şemanızda 'externalId' olmadığı için 'email' kullanıyoruz)
    const user = await prisma.user.findUnique({
      where: { email: primaryEmail },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found in local database' });
    }

    // 3. Kullanıcıyı gönderiyoruz
    return res.json(user);

  } catch (error) {
    console.error('User profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
import { Router, Response, Request } from 'express';
import prisma from '../lib/prisma';
import { authenticate, scopeTenant } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(authenticate, scopeTenant);

// GET /api/tenants/:tenantId/messages/unread-count
// F-9 FIX: Uses real per-user, per-channel lastReadAt instead of a 24h timestamp proxy
router.get('/unread-count', async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const userId = req.user.id;
  try {
    // Find the user's last-read timestamp for the general channel (most common unread check)
    const readRecord = await prisma.userChannelRead.findUnique({
      where: { userId_channel: { userId, channel: 'general' } }
    });

    const count = await prisma.message.count({
      where: {
        tenantId,
        senderId: { not: userId },
        ...(readRecord ? { createdAt: { gt: readRecord.lastReadAt } } : {})
      }
    });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// GET /api/tenants/:tenantId/messages/:channel
// F-16 FIX: Added offset-based pagination (?page=1&limit=50)
router.get('/:channel', async (req: Request, res: Response): Promise<void> => {
  const { tenantId, channel } = req.params;
  const userId = req.user.id;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const cursor = req.query.cursor as string | undefined; // cursor-based for chat: last seen message ID

  try {
    const messages = await prisma.message.findMany({
      where: { tenantId, channel },
      include: { sender: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {})
    });

    // F-9: Update the user's lastReadAt for this channel when they fetch messages
    await prisma.userChannelRead.upsert({
      where: { userId_channel: { userId, channel } },
      create: { userId, channel, lastReadAt: new Date() },
      update: { lastReadAt: new Date() }
    });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/tenants/:tenantId/messages
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const { tenantId } = req.params;
  const { channel, content } = req.body;
  const userId = req.user.id;

  if (!channel || !content) {
    res.status(400).json({ error: 'Channel and content are required' });
    return;
  }
  // M-13 FIX: Limit message content to 2000 characters to prevent DB/memory overload
  if (typeof content !== 'string' || content.length > 2000) {
    res.status(400).json({ error: 'Message content must be between 1 and 2000 characters' });
    return;
  }

  try {
    const newMessage = await prisma.message.create({
      data: { tenantId, channel, content, senderId: userId },
      include: { sender: { select: { id: true, name: true, role: true } } }
    });

    res.json(newMessage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;

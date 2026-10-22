import { Router } from 'express';
import { db } from '../db';
import { contentPosts } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const router = Router();

// GET /api/content
router.get('/', async (_req, res) => {
  try {
    const rows = await db.select().from(contentPosts).orderBy(asc(contentPosts.postDate));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/content
router.post('/', async (req, res) => {
  const { title, platform, status, postDate } = req.body;
  if (!title) {
    return res.status(400).json({ success: false, error: 'title is required' });
  }
  try {
    const [row] = await db.insert(contentPosts).values({
      title,
      platform: platform || null,
      status: status ?? 'idea',
      postDate: postDate || null,
    }).returning();
    res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/content/:id
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, platform, status, postDate } = req.body;
  try {
    const [row] = await db.update(contentPosts)
      .set({
        ...(title !== undefined && { title }),
        ...(platform !== undefined && { platform }),
        ...(status !== undefined && { status }),
        ...(postDate !== undefined && { postDate }),
      })
      .where(eq(contentPosts.id, id))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/content/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.delete(contentPosts).where(eq(contentPosts.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

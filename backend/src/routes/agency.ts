import { Router } from 'express';
import { db } from '../db';
import { agencyProjects } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const router = Router();

// GET /api/agency
router.get('/', async (_req, res) => {
  try {
    const rows = await db.select().from(agencyProjects).orderBy(asc(agencyProjects.createdAt));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/agency
router.post('/', async (req, res) => {
  const { client, project, status, deadline, revenue } = req.body;
  if (!client || !project) {
    return res.status(400).json({ success: false, error: 'client and project are required' });
  }
  try {
    const [row] = await db.insert(agencyProjects).values({
      client,
      project,
      status: status ?? 'active',
      deadline: deadline || null,
      revenue: revenue != null ? parseInt(revenue) : null,
    }).returning();
    res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/agency/:id
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { client, project, status, deadline, revenue } = req.body;
  try {
    const [row] = await db.update(agencyProjects)
      .set({
        ...(client !== undefined && { client }),
        ...(project !== undefined && { project }),
        ...(status !== undefined && { status }),
        ...(deadline !== undefined && { deadline }),
        ...(revenue !== undefined && { revenue: revenue != null ? parseInt(revenue) : null }),
      })
      .where(eq(agencyProjects.id, id))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/agency/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.delete(agencyProjects).where(eq(agencyProjects.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

import { Router } from 'express';
import { db } from '../db';
import { schoolTasks } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const router = Router();

// GET /api/school
router.get('/', async (_req, res) => {
  try {
    const rows = await db.select().from(schoolTasks).orderBy(asc(schoolTasks.dueDate));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/school
router.post('/', async (req, res) => {
  const { course, assignment, dueDate, status, isExam } = req.body;
  if (!course || !assignment) {
    return res.status(400).json({ success: false, error: 'course and assignment are required' });
  }
  try {
    const [row] = await db.insert(schoolTasks).values({
      course,
      assignment,
      dueDate: dueDate || null,
      status: status ?? 'todo',
      isExam: isExam ?? false,
    }).returning();
    res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/school/:id
router.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { course, assignment, dueDate, status, isExam } = req.body;
  try {
    const [row] = await db.update(schoolTasks)
      .set({
        ...(course !== undefined && { course }),
        ...(assignment !== undefined && { assignment }),
        ...(dueDate !== undefined && { dueDate }),
        ...(status !== undefined && { status }),
        ...(isExam !== undefined && { isExam }),
      })
      .where(eq(schoolTasks.id, id))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/school/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await db.delete(schoolTasks).where(eq(schoolTasks.id, id));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

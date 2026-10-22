import { Router } from 'express';
import { runMorningBriefing, runExamAlerts, runWeeklyPlanningPrompt } from '../bot';

const router = Router();

router.post('/briefing', async (_req, res) => {
  try {
    await runMorningBriefing();
    res.json({ success: true, message: 'Morning briefing sent' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/exam-alerts', async (_req, res) => {
  try {
    await runExamAlerts();
    res.json({ success: true, message: 'Exam alerts checked' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/weekly-prompt', async (_req, res) => {
  try {
    await runWeeklyPlanningPrompt();
    res.json({ success: true, message: 'Weekly planning prompt sent' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

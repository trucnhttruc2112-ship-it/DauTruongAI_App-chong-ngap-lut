import express from 'express';
import { floodPointController } from '../controllers/floodPointController.js';

const router = express.Router();

// GET /api/wards/:wardId/flood-points
router.get('/:wardId/flood-points', (req, res) => floodPointController.getWardPoints(req, res));

export default router;

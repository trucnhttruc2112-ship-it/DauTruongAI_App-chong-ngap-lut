import express from 'express';
import { floodPointController } from '../controllers/floodPointController.js';

const router = express.Router();

// GET /api/flood-points
router.get('/', (req, res) => floodPointController.listPoints(req, res));

// GET /api/flood-points/:id
router.get('/:id', (req, res) => floodPointController.getDetails(req, res));

export default router;

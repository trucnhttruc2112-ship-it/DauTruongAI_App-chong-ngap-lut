import express from 'express';
import { floodPointController } from '../controllers/floodPointController.js';
import { confirmationController } from '../controllers/confirmationController.js';

const router = express.Router();

// GET /api/flood-points
router.get('/', (req, res) => floodPointController.listPoints(req, res));

// GET /api/flood-points/:id
router.get('/:id', (req, res) => floodPointController.getDetails(req, res));

// POST /api/flood-points/:id/confirm
router.post('/:id/confirm', (req, res) => confirmationController.confirmPoint(req, res));

export default router;

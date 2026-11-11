import express from 'express';
import { floodPointController } from '../controllers/floodPointController.js';
import { confirmationController } from '../controllers/confirmationController.js';
import { wardActionController } from '../controllers/wardActionController.js';
import { confirmIpLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// GET /api/flood-points
router.get('/', (req, res) => floodPointController.listPoints(req, res));

// GET /api/flood-points/:id
router.get('/:id', (req, res) => floodPointController.getDetails(req, res));

// POST /api/flood-points/:id/confirm (áp dụng confirmIpLimiter chống spam xác nhận)
router.post('/:id/confirm', confirmIpLimiter, (req, res) => confirmationController.confirmPoint(req, res));

// POST /api/flood-points/:id/ward-action (trang phường: tiếp nhận, đang xử lý, đóng...)
router.post('/:id/ward-action', (req, res) => wardActionController.doAction(req, res));

export default router;

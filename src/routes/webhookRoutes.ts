import { Router } from 'express';
import { verifyWebhook, processWebhook } from '../controllers/webhookController';

const router = Router();

// Webhook verification endpoint (GET)
router.get('/webhook', verifyWebhook);

// Webhook event handling endpoint (POST)
router.post('/webhook', processWebhook);

export default router;
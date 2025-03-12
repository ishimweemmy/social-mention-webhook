import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import bodyParser from 'body-parser';
import { config } from './config';
import logger from './utils/logger';
import webhookRoutes from './routes/webhookRoutes';

// Initialize Express app
const app = express();

// Apply middleware
app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(bodyParser.json());

// Register routes
app.use('/api', webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Default route
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Social Mention Webhook API',
        version: '1.0.0',
    });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error(`Unhandled error: ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start the server
const PORT = config.server.port;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} in ${config.server.environment} mode`);
});

export default app;
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import api from './routes/api.js';
const app = express();
const allowedOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';

app.disable('x-powered-by');
app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
}));
app.use('/api', api);
app.use((_req, res) => res.status(404).json({ message: 'API route not found.' }));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ZodError') {
        return res.status(400).json({ message: 'Validation failed.', errors: 'issues' in err ? err.issues : [] });
    }
    if (err && typeof err === 'object' && 'code' in err && err.code === 11000) {
        return res.status(409).json({ message: 'A record with those details already exists.' });
    }
    if (err && typeof err === 'object' && 'name' in err && err.name === 'CastError') {
        return res.status(400).json({ message: 'Invalid record identifier.' });
    }
    if (err && typeof err === 'object' && 'name' in err && err.name === 'ValidationError') {
        return res.status(400).json({ message: 'The submitted record is invalid.' });
    }
    console.error('API request failed:', err instanceof Error ? err.name : 'UnknownError');
    return res.status(500).json({ message: 'Internal server error.' });
});

const port = Number(process.env.PORT ?? 4000);

async function start() {
    const mongoUri = process.env.MONGODB_URI;
    const jwtSecret = process.env.JWT_SECRET;
    if (!mongoUri) throw new Error('MONGODB_URI is required. Configure it in server/.env.');
    if (!jwtSecret || jwtSecret.length < 32 || jwtSecret.startsWith('replace-with-')) {
        throw new Error('Set JWT_SECRET in server/.env to a unique random value of at least 32 characters.');
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');

    try {
        await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10_000 });
    } catch {
        throw new Error('Could not connect to MongoDB. Check MONGODB_URI, network access, and database permissions.');
    }
    console.log('MongoDB connected');
    app.listen(port, '0.0.0.0', () => console.log(`ArtVista API listening on port ${port}`));
}

start().catch(error => {
    console.error('Failed to start API:', error instanceof Error ? error.message : 'Unexpected startup error.');
    process.exit(1);
});

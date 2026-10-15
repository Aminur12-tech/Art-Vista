import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Attendance, ClassSession, FeeObligation, Payment, Student, User } from '../models/index.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { recordAttendance } from '../services/fees.js';

const router = Router();
const asyncRoute = (fn: (req: AuthRequest, res: import('express').Response) => Promise<unknown>) =>
    (req: AuthRequest, res: import('express').Response, next: import('express').NextFunction) =>
        Promise.resolve(fn(req, res)).catch(next);

const registrationSchema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    password: z.string().min(10).max(128),
});
const credentialsSchema = z.object({
    email: z.string().trim().email().max(254),
    password: z.string().min(1).max(128),
});

function tokenFor(userId: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not configured');
    return jwt.sign({ sub: userId }, secret, { expiresIn: '8h' });
}

router.get('/health', (_req, res) => {
    const ready = Boolean(process.env.MONGODB_URI) && Boolean(process.env.JWT_SECRET) && mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({
        ok: ready,
        service: 'ArtVista API',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        time: new Date().toISOString(),
    });
});

router.get('/auth/status', asyncRoute(async (_req, res) => {
    res.json({ registrationOpen: !(await User.exists({})) });
}));

router.post('/auth/register', asyncRoute(async (req, res) => {
    const data = registrationSchema.parse(req.body);
    if (await User.exists({})) return res.status(403).json({ message: 'Studio setup is already complete. Please sign in.' });
    if (!process.env.JWT_SECRET) return res.status(503).json({ message: 'Server authentication is not configured.' });

    const email = data.email.toLowerCase();
    const user = await User.create({
        name: data.name,
        email,
        passwordHash: await bcrypt.hash(data.password, 12),
    });
    return res.status(201).json({
        token: tokenFor(user.id),
        user: { id: user.id, name: user.name, email: user.email },
    });
}));

router.post('/auth/login', asyncRoute(async (req, res) => {
    const data = credentialsSchema.parse(req.body);
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
        return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    return res.json({
        token: tokenFor(user.id),
        user: { id: user.id, name: user.name, email: user.email },
    });
}));

router.use(requireAuth);

router.get('/auth/me', asyncRoute(async (req, res) => {
    const user = await User.findById(req.userId).select('name email');
    if (!user) return res.status(401).json({ message: 'User account no longer exists.' });
    return res.json({ id: user.id, name: user.name, email: user.email });
}));

router.get('/students', asyncRoute(async (req, res) => {
    const query = String(req.query.q ?? '').slice(0, 100);
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = escapedQuery
        ? { $or: [
            { name: { $regex: escapedQuery, $options: 'i' } },
            { studentId: { $regex: escapedQuery, $options: 'i' } },
            { phone: { $regex: escapedQuery, $options: 'i' } },
        ] }
        : {};
    return res.json(await Student.find(filter).sort({ createdAt: -1 }).limit(500));
}));

router.post('/students', asyncRoute(async (req, res) => {
    const data = z.object({
        name: z.string().trim().min(1).max(100),
        guardian: z.string().trim().min(1).max(100),
        phone: z.string().trim().min(7).max(30),
        joined: z.coerce.date(),
        group: z.string().trim().min(1).max(60).optional(),
    }).parse(req.body);
    const phone = data.phone.replace(/\D/g, '');
    if (phone.length < 7 || phone.length > 15) return res.status(400).json({ message: 'Enter a valid guardian phone number.' });
    const student = await Student.create({
        ...data,
        phone,
        studentId: `ST${new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase()}`,
    });
    return res.status(201).json(student);
}));

router.patch('/students/:id', asyncRoute(async (req, res) => {
    const data = z.object({
        name: z.string().trim().min(1).max(100).optional(),
        guardian: z.string().trim().min(1).max(100).optional(),
        phone: z.string().trim().min(7).max(30).optional(),
        group: z.string().trim().min(1).max(60).optional(),
        active: z.boolean().optional(),
    }).parse(req.body);
    if (data.phone) data.phone = data.phone.replace(/\D/g, '');
    const student = await Student.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!student) return res.status(404).json({ message: 'Student not found.' });
    return res.json(student);
}));

router.get('/attendance', asyncRoute(async (req, res) => {
    const date = req.query.date ? String(req.query.date) : undefined;
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ message: 'Date must use YYYY-MM-DD format.' });
    }
    const sessionFilter = date ? { date: new Date(`${date}T00:00:00.000Z`) } : {};
    const sessions = await ClassSession.find(sessionFilter).select('_id date');
    if (!sessions.length) return res.json([]);
    return res.json(await Attendance.find({ sessionId: { $in: sessions.map(session => session._id) } })
        .populate('studentId')
        .populate('sessionId', 'date'));
}));

router.post('/attendance', asyncRoute(async (req, res) => {
    const data = z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        studentId: z.string().regex(/^[a-f\d]{24}$/i),
        present: z.boolean(),
    }).parse(req.body);
    if (!(await Student.exists({ _id: data.studentId }))) return res.status(404).json({ message: 'Student not found.' });
    const result = await recordAttendance(data.date, data.studentId, data.present);
    return res.json(result);
}));

router.get('/fees', asyncRoute(async (_req, res) => {
    return res.json(await FeeObligation.find().populate('studentId').sort({ created: -1 }));
}));

router.post('/payments', asyncRoute(async (req, res) => {
    const data = z.object({
        studentId: z.string().regex(/^[a-f\d]{24}$/i),
        feeId: z.string().regex(/^[a-f\d]{24}$/i),
        amount: z.number().positive().finite(),
        method: z.enum(['Cash', 'UPI', 'Bank Transfer']),
        date: z.coerce.date(),
        reference: z.string().max(200).optional(),
    }).parse(req.body);

    const session = await Student.db.startSession();
    let result: { payment: unknown; fee: unknown } | undefined;
    let failure: { status: number; message: string } | undefined;
    try {
        await session.withTransaction(async () => {
            const fee = await FeeObligation.findOneAndUpdate(
                {
                    _id: data.feeId,
                    studentId: data.studentId,
                    $expr: { $lte: [{ $add: ['$paid', data.amount] }, '$amount'] },
                },
                [{ $set: { paid: { $add: ['$paid', data.amount] } } }],
                { new: true, session },
            );
            if (!fee) {
                const existing = await FeeObligation.findById(data.feeId).session(session);
                if (!existing) failure = { status: 404, message: 'Fee obligation not found.' };
                else if (String(existing.studentId) !== data.studentId) failure = { status: 400, message: 'Fee does not belong to this student.' };
                else failure = { status: 400, message: 'Payment exceeds outstanding balance.' };
                return;
            }
            fee.status = fee.paid >= fee.amount ? 'paid' : 'partial';
            await fee.save({ session });
            const [payment] = await Payment.create([{
                paymentId: `P-${new mongoose.Types.ObjectId().toString().slice(-8).toUpperCase()}`,
                studentId: data.studentId,
                feeId: data.feeId,
                amount: data.amount,
                method: data.method,
                date: data.date,
                reference: data.reference ?? '',
            }], { session });
            result = { payment, fee };
        });
    } finally {
        await session.endSession();
    }
    if (failure) return res.status(failure.status).json({ message: failure.message });
    return res.status(201).json(result);
}));

router.get('/payments', asyncRoute(async (_req, res) => {
    return res.json(await Payment.find()
        .populate('studentId')
        .populate('feeId')
        .sort({ date: -1 })
        .limit(1000));
}));

router.get('/dashboard', asyncRoute(async (_req, res) => {
    const [students, fees, payments] = await Promise.all([
        Student.countDocuments({ active: true }),
        FeeObligation.find(),
        Payment.find({ date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }),
    ]);
    return res.json({
        activeStudents: students,
        outstanding: fees.reduce((sum, fee) => sum + fee.amount - fee.paid, 0),
        collectedThisMonth: payments.reduce((sum, payment) => sum + payment.amount, 0),
        feeObligations: fees.length,
    });
}));

export default router;

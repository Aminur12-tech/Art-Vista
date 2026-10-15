export type Student = {
    id: string;
    dbId: string;
    name: string;
    guardian: string;
    phone: string;
    joined: string;
    group: string;
    active: boolean;
    progress: number;
    totalAttended: number;
};

export type Fee = {
    id: string;
    dbId: string;
    studentId: string;
    amount: number;
    paid: number;
    created: string;
    cycle: number;
};

export type Payment = {
    id: string;
    studentId: string;
    feeId: string;
    amount: number;
    method: string;
    date: string;
};

export type Attendance = { date: string; studentId: string; present: boolean };
export type Store = { students: Student[]; fees: Fee[]; payments: Payment[]; attendance: Attendance[] };
export type StudioUser = { id: string; name: string; email: string };

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOKEN_KEY = 'artvista-auth-token';

export class ApiError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
        this.name = 'ApiError';
    }
}

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    let response: Response;
    try {
        response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } catch {
        throw new ApiError('Cannot reach the ArtVista API. Check that the server is running.', 0);
    }

    const text = await response.text();
    let body: { message?: string } | null = null;
    if (text) {
        try {
            body = JSON.parse(text) as { message?: string };
        } catch {
            throw new ApiError('The ArtVista API returned an invalid response.', response.status);
        }
    }
    if (!response.ok) throw new ApiError(body?.message || `Request failed (${response.status}).`, response.status);
    return body as T;
}

type MongoRef = string | { _id: string; studentId?: string; feeId?: string };
type StudentRecord = Omit<Student, 'id' | 'dbId' | 'joined'> & { _id: string; studentId: string; joined: string };
type FeeRecord = Omit<Fee, 'id' | 'dbId' | 'studentId' | 'created'> & { _id: string; feeId: string; studentId: MongoRef; created: string };
type PaymentRecord = Omit<Payment, 'id' | 'studentId' | 'feeId' | 'date'> & { _id: string; paymentId: string; studentId: MongoRef; feeId: MongoRef; date: string };
type AttendanceRecord = { studentId: MongoRef & { studentId: string }; present: boolean; sessionId: { date: string } };

function refId(value: MongoRef) {
    return typeof value === 'string' ? value : value._id;
}

function dateOnly(value: string) {
    return new Date(value).toISOString().slice(0, 10);
}

export async function loadStore(): Promise<Store> {
    const [studentRows, feeRows, paymentRows, attendanceRows] = await Promise.all([
        request<StudentRecord[]>('/students'),
        request<FeeRecord[]>('/fees'),
        request<PaymentRecord[]>('/payments'),
        request<AttendanceRecord[]>('/attendance'),
    ]);

    const students = studentRows.map((student): Student => ({
        id: student.studentId,
        dbId: student._id,
        name: student.name,
        guardian: student.guardian,
        phone: student.phone,
        joined: dateOnly(student.joined),
        group: student.group,
        active: student.active,
        progress: student.progress,
        totalAttended: student.totalAttended,
    }));
    const studentCodeByDbId = new Map(students.map(student => [student.dbId, student.id]));
    const feeCodeByDbId = new Map(feeRows.map(fee => [fee._id, fee.feeId]));
    const fees = feeRows.map((fee): Fee => ({
        id: fee.feeId,
        dbId: fee._id,
        studentId: typeof fee.studentId === 'string'
            ? studentCodeByDbId.get(fee.studentId) ?? fee.studentId
            : fee.studentId.studentId ?? fee.studentId._id,
        amount: fee.amount,
        paid: fee.paid,
        created: dateOnly(fee.created),
        cycle: fee.cycle,
    }));
    const payments = paymentRows.map((payment): Payment => ({
        id: payment.paymentId,
        studentId: typeof payment.studentId === 'string'
            ? studentCodeByDbId.get(payment.studentId) ?? payment.studentId
            : payment.studentId.studentId ?? payment.studentId._id,
        feeId: typeof payment.feeId === 'string'
            ? feeCodeByDbId.get(payment.feeId) ?? payment.feeId
            : payment.feeId.feeId ?? payment.feeId._id,
        amount: payment.amount,
        method: payment.method,
        date: dateOnly(payment.date),
    }));
    const attendance = attendanceRows.map((record): Attendance => ({
        date: dateOnly(record.sessionId.date),
        studentId: typeof record.studentId === 'string'
            ? studentCodeByDbId.get(record.studentId) ?? record.studentId
            : record.studentId.studentId ?? record.studentId._id,
        present: record.present,
    }));
    return { students, fees, payments, attendance };
}

export function apiStudentId(student: Student) {
    return student.dbId;
}

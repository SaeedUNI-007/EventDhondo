// // server.js
// const express = require('express');
// const cors = require('cors');
// const path = require('path');
// require('dotenv').config({ path: path.join(__dirname, '.env') });

// // 1. IMPORT DATABASE CONNECTION
// const { poolPromise } = require('./db');

// // 2. IMPORT ROUTE FILES
// const authRoutes = require('./auth');
// const dataRoutes = require('./data');
// const teamRoutes = require('./team');
// const adminRoutes = require('./routes/admin'); // NEW: Import admin routes

// // 3. IMPORT MIDDLEWARE
// const { authMiddleware } = require('./middleware/auth');

// const app = express();

// // Middleware
// const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';
// app.use(express.json({ limit: requestBodyLimit }));
// app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

// // CORS Configuration - Restrict to allowed origins
// const corsOptions = {
//     origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
//     credentials: true,
// };
// app.use(cors(corsOptions));

// // 3. REGISTER YOUR NEW ROUTES
// app.use('/api/auth', authRoutes);           // All routes in auth.js will start with /api/auth
// app.use('/api', dataRoutes);                // All routes in data.js will start with /api
// app.use('/api/teams', authMiddleware, teamRoutes); // Teams require authentication
// app.use('/api/admin', adminRoutes);         // Admin routes (auth required in admin.js)

// // 4. TEST ROUTE: GET ALL USERS (Refactored to use the new poolPromise)
// app.get('/api/users', async (req, res) => {
//     try {
//         const pool = await poolPromise;
//         const result = await pool.request().query('SELECT * FROM Users');
//         res.json(result.recordset);
//     } catch (err) {
//         res.status(500).send(err.message);
//     }
// });

// // 5. TEST ROUTE: HELLO WORLD
// app.get('/', (req, res) => {
//     res.send('EventDhondo Backend is Live!');
// });

// // Return a friendly response when payload exceeds request body limit.
// app.use((err, req, res, next) => {
//     if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
//         return res.status(400).json({
//             success: false,
//             message: 'Malformed request payload. If you use browser extensions, disable request-modifying extensions and retry.',
//         });
//     }

//     if (err?.type === 'entity.too.large') {
//         return res.status(413).json({
//             success: false,
//             message: `Request payload too large. Reduce image size or set REQUEST_BODY_LIMIT (current ${requestBodyLimit}).`,
//         });
//     }
//     return next(err);
// });

// const PORT = Number(process.env.API_PORT || process.env.PORT) || 5000;
// const server = app.listen(PORT, () => {
//     console.log(`🚀 Server running on http://localhost:${PORT}`);
// });

// server.on('error', (err) => {
//     if (err?.code === 'EADDRINUSE') {
//         console.error(`❌ Port ${PORT} is already in use. Stop the existing backend process and retry.`);
//         process.exit(1);
//     }
//     console.error('❌ Server failed to start:', err);
//     process.exit(1);
// });

// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─── Startup validation ────────────────────────────────────────────────────
// Fail fast with a clear message if required env vars are missing so the
// developer knows exactly why the server exited with code 1.
const REQUIRED_ENV = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_DATABASE'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length > 0) {
    console.error('❌ Server cannot start: missing required environment variables:');
    missingEnv.forEach((k) => console.error(`   • ${k}`));
    console.error('   Check your backend/.env file and make sure all DB_* variables are set.');
    process.exit(1);
}

// ─── Database ──────────────────────────────────────────────────────────────
const { poolPromise } = require('./db');

// ─── Routes ───────────────────────────────────────────────────────────────
const authRoutes  = require('./auth');
const dataRoutes  = require('./data');
const teamRoutes  = require('./team');
const adminRoutes = require('./routes/admin');
const notificationsRouter = require('./routes/notifications');

// ─── Middleware ────────────────────────────────────────────────────────────
const { authMiddleware } = require('./middleware/auth');

const app = express();

const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || '10mb';
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));

console.log(`🔒 CORS origins: ${allowedOrigins.join(', ')}`);

// ─── Register routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/notifications', notificationsRouter);
app.use('/api', dataRoutes);
app.use('/api/teams', authMiddleware, teamRoutes);
app.use('/api/admin', adminRoutes);

// Convenience: list all users (dev/test only).
app.get('/api/users', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Users');
        res.json(result.recordset);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/', (_req, res) => res.send('EventDhondo Backend is Live!'));

// ─── Error handlers ────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            success: false,
            message: 'Malformed JSON in request body. Check Content-Type and JSON syntax.',
        });
    }
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({
            success: false,
            message: `Request payload too large. Reduce image size or increase REQUEST_BODY_LIMIT (current: ${requestBodyLimit}).`,
        });
    }
    console.error('Unhandled server error:', err);
    return next(err);
});

// ─── Start listening ───────────────────────────────────────────────────────
const PORT = Number(process.env.API_PORT || process.env.PORT) || 5000;

// Wait for the DB pool to be ready before accepting traffic.
// This means if the DB is down, the process exits (via db.js) before the
// port is even bound – giving a clear startup failure signal.
poolPromise
    .then(() => {
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });

        server.on('error', (err) => {
            if (err?.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use.`);
                console.error('   Run: netstat -ano | findstr :' + PORT);
                console.error('   Then kill the process with: taskkill /PID <pid> /F');
                process.exit(1);
            }
            console.error('❌ Server failed to start:', err.message);
            process.exit(1);
        });
    })
    .catch((err) => {
        // db.js already logs and calls process.exit(1) on connection failure,
        // but this catch is a safety net in case that changes.
        console.error('❌ Could not initialise database pool:', err.message);
        process.exit(1);
    });
import express from 'express';
import session from 'express-session';
import { config } from './config.js';
import { isDatabaseError, isDatabaseUnavailable, verifyDatabaseConnection } from './db.js';
import authRoutes from './routes/authRoutes.js';
import socialRoutes from './routes/socialRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { ServiceError } from './utils/errors.js';

const app = express();

if (config.isProduction) {
  // Needed for `secure` cookies behind a reverse proxy / hosting platform.
  app.set('trust proxy', 1);
}

// Profile edits can carry a small resized avatar image, so /api/me gets a larger
// body limit. Everything else stays at 10kb. (A later sprint could move avatars
// to real file storage and drop this.)
app.use('/api/me', express.json({ limit: '400kb' }));
app.use(express.json({ limit: '10kb' }));

app.use(
  session({
    name: config.session.cookieName,
    secret: config.session.secret,
    resave: false,
    saveUninitialized: false, // no cookie until someone actually logs in
    cookie: config.session.cookie,
    // No `store` option means express-session's built-in MemoryStore: sessions
    // live in this process and are cleared on restart (users just log in again;
    // their accounts are safe in MySQL). A MySQL-backed session store needs its
    // own `sessions` table, which isn't in the team schema yet (a team decision).
  }),
);

app.use('/api/auth', authRoutes);
app.use('/api/me', userRoutes);
app.use('/api/users', socialRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Central error handler. Express 5 forwards errors from async handlers here.
app.use((err, req, res, next) => {
  if (err instanceof ServiceError) {
    return res.status(err.status).json({ error: err.message, fieldErrors: err.fieldErrors });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That request is too large.' });
  }
  if (isDatabaseUnavailable(err)) {
    console.error(`[db] Database unavailable (${err.code}).`);
    return res.status(503).json({ error: 'TuneBoxd can’t reach its database right now. Please try again shortly.' });
  }
  if (isDatabaseError(err)) {
    // Log only the code and MySQL's message. Never the SQL, bound values or
    // connection details, and never send any of it to the browser.
    console.error(`[db] Query failed: ${err.code} ${err.sqlMessage ?? ''}`);
  } else {
    console.error(err);
  }
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// Check the database before accepting requests, so "can't reach RDS" is
// reported clearly at startup instead of showing up as a login bug later.
try {
  await verifyDatabaseConnection();
  console.log('Database connection successful.');
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`TuneBoxd API listening on http://localhost:${config.port}`);
});

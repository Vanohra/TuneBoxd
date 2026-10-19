/**
 * The Express app: middleware, routes and the central error handler.
 * server.js checks the database and starts listening; tests import this file
 * directly and listen on a random port.
 */
import express from 'express';
import session from 'express-session';
import { config } from './config.js';
import { isDatabaseError, isDatabaseUnavailable } from './db.js';
import authRoutes from './routes/authRoutes.js';
import commentRoutes from './routes/commentRoutes.js';
import diaryRoutes from './routes/diaryRoutes.js';
import musicRoutes from './routes/musicRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import socialRoutes from './routes/socialRoutes.js';
import userRoutes from './routes/userRoutes.js';
import { ServiceError } from './utils/errors.js';

const app = express();

if (config.isProduction) {
  // Needed for `secure` cookies behind a reverse proxy / hosting platform.
  app.set('trust proxy', 1);
}

// Profile edits can carry a small resized avatar image, so /api/me gets a larger
// body limit. Reviews can be up to 5,000 characters (up to 4 bytes each in
// UTF-8), so they get 32kb. Everything else stays at 10kb. (A later sprint could
// move avatars to real file storage and drop the /api/me exception.)
app.use('/api/me', express.json({ limit: '400kb' }));
app.use('/api/reviews', express.json({ limit: '32kb' }));
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
app.use('/api/music', musicRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/diary', diaryRoutes);

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

export default app;

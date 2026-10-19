import app from './app.js';
import { config } from './config.js';
import { verifyDatabaseConnection } from './db.js';

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

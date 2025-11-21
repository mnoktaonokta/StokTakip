import { createServer } from './server';
import { env } from './config/env';

const app = createServer();

app.listen(env.port, () => {
  console.log(`API server listening on http://localhost:${env.port}`);
});

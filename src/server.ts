import { createServer } from 'http';

export function startHealthServer() {
  const port = process.env.PORT || 3000;
  
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'healthy',
        service: 'solana-whale-tracker',
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(port, () => {
    console.log(`Health server running on port ${port}`);
  });

  return server;
}
const PORT = process.env.PORT || 3000;
const VERSION = process.env.npm_package_version || '1.0.0';

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // Health check endpoint
    if (url.pathname === '/api/v1/status') {
      return Response.json({
        status: 'healthy',
        version: VERSION,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    }

    // 404 for all other routes
    return Response.json(
      { error: 'Not found' },
      { status: 404 }
    );
  },
});

console.log(`🚀 API server running on http://localhost:${server.port}`);
console.log(`📍 Health check: http://localhost:${server.port}/api/v1/status`);

export default async function handler(req, res) {
  try {
    const { default: app } = await import('../backend/dist/app.js');
    return app(req, res);
  } catch (err) {
    console.error('[API Serverless Error]:', err);
    return res.status(500).json({
      error: 'API Serverless Function Crash',
      message: err?.message || String(err),
      stack: err?.stack,
    });
  }
}

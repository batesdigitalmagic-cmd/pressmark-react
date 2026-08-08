export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, current, channel } = req.query;

  const latestVersion = '1.0.0';

  return res.status(200).json({
    ok: true,
    product: product || 'batchcutout',
    channel: channel || 'stable',
    current: current || '',
    latest: latestVersion,
    update_available:
      !!current && current !== latestVersion,
    download_url: null
  });
}
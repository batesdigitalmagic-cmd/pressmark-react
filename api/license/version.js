export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, current, channel } = req.query;

  const latestVersion = '1.0.0';

  /* Which versions have storage configured. Mirrors api/download.js. */
  const RELEASES = {
    '1.0.0': process.env.DOWNLOAD_URL_1_0_0 || ''
  };

  /* Advertise the download through /api/download rather than the raw storage
     URL. That endpoint is a permanent link on our own domain, so the target
     can move without breaking old purchase emails — and the WorkDrive
     location stays out of a public API response where it could be scraped
     and hotlinked.

     Null when storage is unconfigured: telling the plugin an update exists
     with no way to fetch it is worse than telling it nothing. */
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const baseUrl = host ? `${proto}://${host}` : 'https://pressmark.studio';

  const downloadUrl = RELEASES[latestVersion]
    ? `${baseUrl}/api/download?v=${latestVersion}`
    : null;

  return res.status(200).json({
    ok: true,
    product: product || 'batchcutout',
    channel: channel || 'stable',
    current: current || '',
    latest: latestVersion,
    update_available:
      !!current && current !== latestVersion,
    download_url: downloadUrl
  });
}
/* Versions and their storage URLs come from lib/releases.js, which api/download.js
   reads too. This file used to keep its own copy of the map; the two drifting
   apart is how a release ends up advertised here but un-downloadable there. */
import { LATEST, availableVersions, releaseUrl } from '../../lib/releases.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { product, current, channel } = req.query;

  const latestVersion = LATEST;

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

  const downloadUrl = releaseUrl(latestVersion)
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
    download_url: downloadUrl,
    /* Every release still downloadable, newest last. Additive — existing
       plugin builds read only the fields above and are unaffected. */
    available: availableVersions()
  });
}
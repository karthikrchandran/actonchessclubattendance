import QRCode from 'qrcode';

export async function GET(req, { params }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token || '')) {
    return new Response('Invalid QR token', { status: 400 });
  }

  const checkinUrl = `${req.nextUrl.origin}/q/${token}`;
  const svg = await QRCode.toString(checkinUrl, {
    type: 'svg',
    width: 360,
    margin: 2,
    errorCorrectionLevel: 'M'
  });

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400'
    }
  });
}

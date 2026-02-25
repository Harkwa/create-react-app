const STOOQ_SYMBOLS = '%5ESPX+%5EDJI+%5ENDQ+%5ESNX+%5EHSI+%5ESHC+%5ENKX';
const STOOQ_FIELDS = 'sd2t2ncohl';
const STOOQ_URL = `https://stooq.com/q/l/?s=${STOOQ_SYMBOLS}&f=${STOOQ_FIELDS}&h&e=json`;

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const upstream = await fetch(STOOQ_URL, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!upstream.ok) {
      return response
        .status(502)
        .json({ error: `Market feed request failed (${upstream.status})` });
    }

    const body = await upstream.text();

    try {
      JSON.parse(body);
    } catch {
      return response.status(502).json({ error: 'Market feed returned invalid JSON' });
    }

    response.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=45');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    return response.status(200).send(body);
  } catch {
    return response.status(500).json({ error: 'Failed to reach market feed' });
  }
}

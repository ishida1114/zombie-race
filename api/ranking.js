export default async function handler(req, res) {
  // CORS制限を解除するヘッダーを設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const JSONBLOB_URL = 'https://jsonblob.com/api/jsonBlob/01a10163-5363-72b5-81b5-0735cc9f9e10';

  // 取得 (GET)
  if (req.method === 'GET') {
    try {
      const response = await fetch(JSONBLOB_URL);
      const data = await response.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // 更新 (PUT)
  if (req.method === 'PUT') {
    try {
      const response = await fetch(JSONBLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
}
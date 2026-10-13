import { one } from './db.js';

export function getGoogleMapsApiKey() {
  const row = one("SELECT valor FROM configuracoes WHERE chave IN ('google_maps_api_key','google.maps_api_key') ORDER BY CASE chave WHEN 'google_maps_api_key' THEN 0 ELSE 1 END LIMIT 1");
  return (row?.valor || process.env.GOOGLE_MAPS_API_KEY || '').trim();
}

export function getOsrmServerUrl() {
  const row = one("SELECT valor FROM configuracoes WHERE chave IN ('osrm_server_url','osrm.server_url') ORDER BY CASE chave WHEN 'osrm_server_url' THEN 0 ELSE 1 END LIMIT 1");
  return (row?.valor || process.env.OSRM_SERVER_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
}

/**
 * Ordenação geométrica euclidiana em linha reta (Nearest Neighbor).
 * Utilizada como fallback caso o serviço de roteamento externo esteja inacessível.
 */
export function optimizeEuclidean(depot, points) {
  const rem = [...points];
  const seq = [];
  let cur = { latitude: depot.latitude, longitude: depot.longitude };
  while (rem.length) {
    let bi = 0, bd = Infinity;
    rem.forEach((x, i) => {
      const d = Math.hypot(Number(x.latitude) - cur.latitude, Number(x.longitude) - cur.longitude);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const x = rem.splice(bi, 1)[0];
    seq.push(x);
    cur = { latitude: Number(x.latitude), longitude: Number(x.longitude) };
  }
  return {
    orderedPoints: seq,
    distanceKm: null,
    estimatedMinutes: null,
    source: 'euclidean'
  };
}

/**
 * Ordenação por rota mais curta na malha rodoviária real via OpenStreetMap (OSRM Trip API).
 * 100% gratuito, sem necessidade de chave de API ou cartão de crédito.
 * Sem trânsito ao vivo (calcula a distância e tempo pelas vias reais).
 */
export async function optimizeWithOSRM(depot, points, options = {}) {
  if (!points.length) {
    return { orderedPoints: [], distanceKm: null, estimatedMinutes: null, source: 'openstreetmap' };
  }

  // OSRM aceita coordenadas no formato: longitude,latitude
  const coords = [
    `${Number(depot.longitude)},${Number(depot.latitude)}`,
    ...points.map(p => `${Number(p.longitude)},${Number(p.latitude)}`)
  ].join(';');

  const baseUrl = options.serverUrl || getOsrmServerUrl();
  const url = `${baseUrl}/trip/v1/driving/${coords}?source=first&roundtrip=false&steps=false&overview=false`;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(options.timeoutMs || 8000) });
    if (!resp.ok) {
      console.warn(`[Logística OSRM] Resposta HTTP ${resp.status} do servidor OpenStreetMap. Alternando para euclidiano.`);
      return optimizeEuclidean(depot, points);
    }

    const data = await resp.json();
    if (data.code !== 'Ok' || !data.waypoints || !data.trips?.[0]) {
      console.warn(`[Logística OSRM] Retorno código ${data.code} do OSRM. Alternando para euclidiano.`);
      return optimizeEuclidean(depot, points);
    }

    // OSRM retorna waypoints no mesmo índice de entrada.
    // O índice 0 é o depósito. Os índices 1..N são os clientes na ordem original de points.
    // O atributo waypoint_index representa a posição visitada na rota (0 = primeira parada, 1 = segunda, etc).
    const customerWaypoints = data.waypoints.slice(1).map((w, idx) => ({
      visitOrder: w.waypoint_index,
      point: points[idx]
    }));

    customerWaypoints.sort((a, b) => a.visitOrder - b.visitOrder);
    const orderedPoints = customerWaypoints.map(cw => cw.point);

    const trip = data.trips[0];
    const distanceKm = trip.distance > 0 ? Number((trip.distance / 1000).toFixed(2)) : null;
    const estimatedMinutes = trip.duration > 0 ? Math.round(trip.duration / 60) : null;

    return {
      orderedPoints,
      distanceKm,
      estimatedMinutes,
      source: 'openstreetmap'
    };
  } catch (err) {
    console.warn('[Logística OSRM] Falha ao consultar OpenStreetMap:', err.message);
    return optimizeEuclidean(depot, points);
  }
}

/**
 * Ordenação via Google Maps Directions API (opcional, caso o usuário tenha configurado chave).
 */
export async function optimizeWithGoogleMaps(depot, points, apiKey) {
  if (!points.length) {
    return { orderedPoints: [], distanceKm: null, estimatedMinutes: null, source: 'google_maps' };
  }

  if (points.length === 1) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
      url.searchParams.set('origin', `${depot.latitude},${depot.longitude}`);
      url.searchParams.set('destination', `${points[0].latitude},${points[0].longitude}`);
      url.searchParams.set('mode', 'driving');
      url.searchParams.set('key', apiKey);

      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
      const data = await resp.json();
      if (data.status === 'OK' && data.routes?.[0]?.legs?.[0]) {
        const leg = data.routes[0].legs[0];
        const distKm = Number(((leg.distance?.value || 0) / 1000).toFixed(2));
        const estMin = Math.round((leg.duration?.value || 0) / 60);
        return {
          orderedPoints: [points[0]],
          distanceKm: distKm,
          estimatedMinutes: estMin,
          source: 'google_maps'
        };
      }
    } catch (e) {
      console.warn('[Logística] Aviso na consulta Google Maps (1 parada):', e.message);
    }
    return {
      orderedPoints: [points[0]],
      distanceKm: null,
      estimatedMinutes: null,
      source: 'google_maps'
    };
  }

  if (points.length > 23) {
    console.warn(`[Logística] ${points.length} paradas excede o limite de 23 waypoints do Directions API. Utilizando cálculo euclidiano.`);
    return optimizeEuclidean(depot, points);
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${depot.latitude},${depot.longitude}`);
  url.searchParams.set('destination', `${depot.latitude},${depot.longitude}`);
  url.searchParams.set('waypoints', `optimize:true|${points.map(p => `${Number(p.latitude)},${Number(p.longitude)}`).join('|')}`);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('key', apiKey);

  try {
    const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    const data = await resp.json();

    if (data.status !== 'OK' || !data.routes?.[0]?.waypoint_order) {
      const errorMsg = data.error_message || data.status || 'Resposta inválida do Google Maps';
      console.warn(`[Logística] Google Maps retornou status ${data.status} (${errorMsg}). Alternando para ordenação euclidiana.`);
      return optimizeEuclidean(depot, points);
    }

    const order = data.routes[0].waypoint_order;
    const orderedPoints = order.map(idx => points[idx]);

    let totalMeters = 0;
    let totalSeconds = 0;
    const legs = data.routes[0].legs || [];
    for (let i = 0; i < points.length && i < legs.length; i++) {
      totalMeters += legs[i].distance?.value || 0;
      totalSeconds += legs[i].duration?.value || 0;
    }

    const distanceKm = totalMeters > 0 ? Number((totalMeters / 1000).toFixed(2)) : null;
    const estimatedMinutes = totalSeconds > 0 ? Math.round(totalSeconds / 60) : null;

    return {
      orderedPoints,
      distanceKm,
      estimatedMinutes,
      source: 'google_maps'
    };
  } catch (err) {
    console.warn('[Logística] Erro ao consultar Google Maps Directions API:', err.message);
    return optimizeEuclidean(depot, points);
  }
}

/**
 * Calcula a sequência completa da rota de entregas.
 * Por padrão utiliza OpenStreetMap (OSRM) — sem necessidade de chave de API.
 * Se houver chave do Google Maps configurada, pode utilizá-la.
 * Em caso de qualquer falha, faz fallback seguro para euclidiano (linha reta).
 */
export async function calculateRouteSequence(orders, depotLat, depotLng) {
  const points = orders.filter(
    x => x.latitude != null && x.longitude != null && !Number.isNaN(Number(x.latitude)) && !Number.isNaN(Number(x.longitude))
  );
  const withoutPoints = orders.filter(x => !points.includes(x));

  if (!points.length || !Number.isFinite(depotLat) || !Number.isFinite(depotLng)) {
    return {
      ordered: [...orders],
      distanceKm: null,
      estimatedMinutes: null,
      source: 'manual'
    };
  }

  const depot = { latitude: depotLat, longitude: depotLng };
  const googleKey = getGoogleMapsApiKey();

  let result;
  if (googleKey) {
    // Se o usuário configurou explicitamente uma chave Google Maps
    result = await optimizeWithGoogleMaps(depot, points, googleKey);
  } else {
    // Padrão: OpenStreetMap (OSRM) gratuito, sem necessidade de API key
    result = await optimizeWithOSRM(depot, points);
  }

  return {
    ordered: [...result.orderedPoints, ...withoutPoints],
    distanceKm: result.distanceKm,
    estimatedMinutes: result.estimatedMinutes,
    source: result.source
  };
}

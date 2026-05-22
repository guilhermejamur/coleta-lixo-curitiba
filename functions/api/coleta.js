/**
 * Cloudflare Pages Function — GET /api/coleta
 *
 * Parâmetros aceitos (via query string):
 *   ?lat=-25.43&lng=-49.27         → coordenadas diretas
 *   ?endereco=Rua+XV+700           → geocodifica e busca a área
 *
 * Resposta JSON:
 * {
 *   "coordenadas": { "lat": -25.43, "lng": -49.27 },
 *   "encontrado": true,
 *   "seletiva": { ... },
 *   "domiciliar": { ... }
 * }
 */

// Cache em memória por isolate (reutilizado entre requests no mesmo Worker)
let _cacheSeletiva = null;
let _cacheDomiciliar = null;
let _cacheConfig = null;

export async function onRequest(context) {
  const { request, env } = context;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  if (request.method !== 'GET') {
    return jsonResponse({ erro: 'Método não permitido. Use GET.' }, 405);
  }

  try {
    const url = new URL(request.url);
    const latParam = url.searchParams.get('lat');
    const lngParam = url.searchParams.get('lng');
    const enderecoParam = url.searchParams.get('endereco');

    let finalLat, finalLng, enderecoUsado;

    // --- Coordenadas diretas ---
    if (latParam && lngParam) {
      finalLat = parseFloat(latParam);
      finalLng = parseFloat(lngParam);
      enderecoUsado = null;

      if (isNaN(finalLat) || isNaN(finalLng)) {
        return jsonResponse({ erro: 'Coordenadas inválidas.' }, 400);
      }

    // --- Geocodificação por endereço ---
    } else if (enderecoParam) {
      const config = await carregarConfig(request, env);
      const geocoded = await geocodificar(enderecoParam, config, env);

      if (!geocoded) {
        return jsonResponse({
          erro: 'Endereço não encontrado.',
          dica: 'Tente incluir cidade e estado. Ex: Rua XV de Novembro 700 Curitiba PR'
        }, 404);
      }

      finalLat = geocoded.lat;
      finalLng = geocoded.lng;
      enderecoUsado = geocoded.display_name;

    } else {
      return jsonResponse({
        erro: 'Parâmetros obrigatórios ausentes.',
        uso: [
          'GET /api/coleta?lat=-25.43&lng=-49.27',
          'GET /api/coleta?endereco=Rua+XV+de+Novembro+700+Curitiba'
        ]
      }, 400);
    }

    // --- Carregar GeoJSON ---
    const [seletiva, domiciliar] = await Promise.all([
      carregarGeoJSON('coleta_seletiva', request, env),
      carregarGeoJSON('coleta_domiciliar', request, env),
    ]);

    // --- Point-in-polygon (exato, depois fallback por proximidade ~22m) ---
    const infoSeletiva = encontrarArea(finalLng, finalLat, seletiva)
      || encontrarArea(finalLng, finalLat, seletiva, true);
    const infoDomiciliar = encontrarArea(finalLng, finalLat, domiciliar)
      || encontrarArea(finalLng, finalLat, domiciliar, true);
    const encontrado = !!(infoSeletiva || infoDomiciliar);

    const resposta = {
      coordenadas: { lat: finalLat, lng: finalLng },
      ...(enderecoUsado && { endereco: enderecoUsado }),
      encontrado,
      seletiva: infoSeletiva ? formatarColeta(infoSeletiva) : null,
      domiciliar: infoDomiciliar ? formatarColeta(infoDomiciliar) : null,
      ...(encontrado
        ? {}
        : { mensagem: 'Localização fora da área de cobertura do serviço.' }
      ),
    };

    return jsonResponse(resposta, 200);

  } catch (err) {
    console.error('Erro na API /coleta:', err);
    return jsonResponse({ erro: 'Erro interno. Tente novamente.' }, 500);
  }
}

// ─────────────────────────────────────────────
// Carregar e cachear GeoJSON via ASSETS binding
// ─────────────────────────────────────────────
async function carregarGeoJSON(nome, request, env) {
  if (nome === 'coleta_seletiva' && _cacheSeletiva) return _cacheSeletiva;
  if (nome === 'coleta_domiciliar' && _cacheDomiciliar) return _cacheDomiciliar;

  try {
    const assetUrl = new URL(`/data/${nome}.geojson`, request.url);
    const resp = await env.ASSETS.fetch(new Request(assetUrl));

    if (!resp.ok) return { features: [] };

    const data = await resp.json();

    if (nome === 'coleta_seletiva') _cacheSeletiva = data;
    if (nome === 'coleta_domiciliar') _cacheDomiciliar = data;

    return data;
  } catch {
    return { features: [] };
  }
}

// ─────────────────────────────────────────────
// Carregar config.json via ASSETS
// ─────────────────────────────────────────────
async function carregarConfig(request, env) {
  if (_cacheConfig) return _cacheConfig;

  const assetUrl = new URL('/config.json', request.url);
  const resp = await env.ASSETS.fetch(new Request(assetUrl));
  _cacheConfig = await resp.json();
  return _cacheConfig;
}

// ─────────────────────────────────────────────
// Geocodificação: Nominatim → Mapbox → Google Maps
// Tokens e chaves nunca são expostos ao cliente.
// ─────────────────────────────────────────────
async function geocodificar(endereco, config, env) {
  const resultNominatim = await geocodificarNominatim(endereco, config);
  if (resultNominatim) return resultNominatim;

  const resultMapbox = await geocodificarMapbox(endereco, config);
  if (resultMapbox) return resultMapbox;

  if (env.GOOGLE_MAPS_KEY) {
    return await geocodificarGoogle(endereco, config, env.GOOGLE_MAPS_KEY);
  }

  return null;
}

async function geocodificarNominatim(endereco, config) {
  try {
    const cidade = config.cidade;
    const [west, north, east, south] = cidade.boundingBox.split(',').map(Number);

    const params = new URLSearchParams({
      q: `${endereco}, ${cidade.nome}, ${cidade.estado}, Brasil`,
      format: 'json',
      limit: '1',
      countrycodes: 'br',
      bounded: '1',
      viewbox: `${west},${south},${east},${north}`,
      addressdetails: '1',
      'accept-language': 'pt',
    });

    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          'User-Agent': `coleta-lixo-${cidade.nome.toLowerCase().replace(/\s+/g, '-')}/1.0`,
          'Accept-Language': 'pt',
        },
      }
    );

    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data?.length) return null;

    const stopWords = new Set([
      'rua', 'avenida', 'av', 'alameda', 'al', 'travessa', 'tv', 'estrada',
      'est', 'praca', 'pc', 'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o',
      'pr', 'br', 'brasil',
    ]);
    const cidadeNorm = cidade.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

    const palavrasQuery = endereco
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w) && !cidadeNorm.includes(w));

    const result = data.find(r => {
      const lat = parseFloat(r.lat);
      const lng = parseFloat(r.lon);
      if (lat < south || lat > north || lng < west || lng > east) return false;

      if (palavrasQuery.length > 0) {
        const addr = r.address || {};
        const rua = (addr.road || addr.pedestrian || r.display_name || '')
          .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (palavrasQuery.filter(w => rua.includes(w)).length === 0) return false;
      }

      return true;
    });

    if (!result) return null;
    return { lat: parseFloat(result.lat), lng: parseFloat(result.lon), display_name: result.display_name };
  } catch {
    return null;
  }
}

async function geocodificarMapbox(endereco, config) {
  const token = config.mapboxToken;
  const bb = config.cidade?.boundingBox?.split(',') || [];
  const bbox = bb.length === 4 ? `${bb[0]},${bb[3]},${bb[2]},${bb[1]}` : '';
  const [lat, lon] = config.cidade?.coordenadas || [];

  const params = new URLSearchParams({
    access_token: token,
    country: 'BR',
    types: 'address',
    language: 'pt',
    limit: '1',
    ...(lon && lat ? { proximity: `${lon},${lat}` } : {}),
    ...(bbox ? { bbox } : {}),
  });

  const resp = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(endereco)}.json?${params}`,
    { headers: { 'Referer': 'https://coleta-lixo-curitiba.pages.dev' } }
  );

  const data = await resp.json();
  if (!data.features?.length) return null;

  const cidadeNorm = config.cidade.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const feature = data.features.find(f => {
    const ctx = f.context || [];
    const cidadeCtx = (ctx.find(c => c.id?.startsWith('place'))?.text || '')
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return cidadeCtx.includes(cidadeNorm);
  });

  if (!feature) return null;
  return { lat: feature.center[1], lng: feature.center[0], display_name: feature.place_name };
}

async function geocodificarGoogle(endereco, config, apiKey) {
  const cidade = config.cidade;
  const [west, north, east, south] = cidade.boundingBox.split(',').map(Number);

  const params = new URLSearchParams({
    address: `${endereco}, ${cidade.nome}, PR, Brasil`,
    key: apiKey,
    language: 'pt',
    region: 'br',
    components: 'country:BR',
  });

  const resp = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  const data = await resp.json();
  if (data.status !== 'OK' || !data.results?.length) return null;

  const result = data.results.find(r => {
    const { lat, lng } = r.geometry.location;
    return lat >= south && lat <= north && lng >= west && lng <= east;
  });

  if (!result) return null;
  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    display_name: result.formatted_address,
  };
}

// ─────────────────────────────────────────────
// Point-in-polygon com fallback por proximidade (~22m)
// Útil para coordenadas no centro de avenidas que fazem fronteira entre setores.
// ─────────────────────────────────────────────
function encontrarArea(lng, lat, geoData, usarFallbackDistancia = false) {
  if (!geoData?.features?.length) return null;

  // 1. Busca exata: ponto dentro do polígono
  for (const feature of geoData.features) {
    if (pontoEmPoligono([lng, lat], feature.geometry)) {
      return feature.properties;
    }
  }

  // 2. Fallback por proximidade: ponto sobre borda de polígono (~22m)
  if (usarFallbackDistancia) {
    const THRESHOLD = 0.0002;
    let menorDist = Infinity;
    let maisProximo = null;

    for (const feature of geoData.features) {
      if (!feature.geometry) continue;
      const dist = distanciaMinPoligono([lng, lat], feature.geometry);
      if (dist < menorDist) {
        menorDist = dist;
        maisProximo = feature.properties;
      }
    }

    if (menorDist <= THRESHOLD) return maisProximo;
  }

  return null;
}

function distanciaMinPoligono(ponto, geometria) {
  if (!geometria) return Infinity;
  const coords = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  let min = Infinity;
  for (const pol of coords) {
    for (const anel of pol) {
      for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
        const d = distPontoSegmento(ponto, anel[i], anel[j]);
        if (d < min) min = d;
      }
    }
  }
  return min;
}

function distPontoSegmento([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.sqrt((px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2);
}

function pontoEmPoligono(ponto, geometria) {
  if (!geometria) return false;
  const grupos =
    geometria.type === 'Polygon' ? [geometria.coordinates] :
    geometria.type === 'MultiPolygon' ? geometria.coordinates : [];

  for (const poligono of grupos) {
    for (const anel of poligono) {
      if (rayCasting(ponto, anel)) return true;
    }
  }
  return false;
}

function rayCasting([x, y], poligono) {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i];
    const [xj, yj] = poligono[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

// ─────────────────────────────────────────────
// Formatadores
// ─────────────────────────────────────────────
function formatarColeta(props) {
  return {
    bairro: props.BAIRRO || null,
    macro: props.MACRO || null,
    setor: props.Setor_2018 || null,
    frequencia_raw: props.FREQUENCIA || props.frequencia || null,
    frequencia: formatarFrequencia(props.FREQUENCIA || props.frequencia),
    turno: formatarTurno(props.TURNO || props.turno),
    horario: formatarHorario(props.Horario || props.HORARIO || props.horario),
    operacao: props['OPERAÇÃO'] || props.operacao || null,
    vezes_por_semana: props.X_SEMANA ? parseInt(props.X_SEMANA) : null,
  };
}

function formatarFrequencia(valor) {
  if (!valor) return null;
  return valor
    .replace(/2ª/g, 'Segunda-feira')
    .replace(/3ª/g, 'Terça-feira')
    .replace(/4ª/g, 'Quarta-feira')
    .replace(/5ª/g, 'Quinta-feira')
    .replace(/6ª/g, 'Sexta-feira')
    .replace(/Sáb\./g, 'Sábado')
    .replace(/Dom\./g, 'Domingo');
}

function formatarTurno(valor) {
  if (!valor) return null;
  const mapa = { DIURNO: 'Diurno (manhã)', VESPERTINO: 'Vespertino (tarde)', NOTURNO: 'Noturno' };
  return mapa[valor?.toUpperCase()] || valor;
}

function formatarHorario(valor) {
  if (!valor) return null;
  return valor
    .replace(/A PARTIR DAS /gi, 'A partir das ')
    .replace(/ATE /gi, 'Até ');
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

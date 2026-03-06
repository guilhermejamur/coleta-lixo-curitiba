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
      const geocoded = await geocodificar(enderecoParam, config.mapboxToken, config);

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

    // --- Point-in-polygon ---
    const infoSeletiva = encontrarArea(finalLng, finalLat, seletiva);
    const infoDomiciliar = encontrarArea(finalLng, finalLat, domiciliar);
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
// Geocodificação via Nominatim (OpenStreetMap)
// Gratuito, sem restrição de domínio, ideal para server-side
// ─────────────────────────────────────────────
async function geocodificar(endereco, _token, config) {
  const bb = config.cidade?.boundingBox?.split(',') || [];
  // Nominatim viewbox: west,south,east,north
  const viewbox = bb.length === 4 ? `${bb[0]},${bb[3]},${bb[2]},${bb[1]}` : null;

  const params = new URLSearchParams({
    q: endereco,
    format: 'json',
    limit: '1',
    countrycodes: 'br',
    addressdetails: '1',
    ...(viewbox ? { viewbox, bounded: '1' } : {}),
  });

  const url = `https://nominatim.openstreetmap.org/search?${params}`;
  const resp = await fetch(url, {
    headers: {
      // Nominatim exige User-Agent identificando a aplicação
      'User-Agent': 'coleta-lixo-curitiba/1.0 (contato@cavo.com.br)',
      'Accept-Language': 'pt-BR,pt',
    },
  });

  const data = await resp.json();
  if (!data?.length) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    display_name: data[0].display_name,
  };
}

// ─────────────────────────────────────────────
// Point-in-polygon (Ray Casting)
// ─────────────────────────────────────────────
function encontrarArea(lng, lat, geoData) {
  if (!geoData?.features?.length) return null;
  for (const feature of geoData.features) {
    if (pontoEmPoligono([lng, lat], feature.geometry)) {
      return feature.properties;
    }
  }
  return null;
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

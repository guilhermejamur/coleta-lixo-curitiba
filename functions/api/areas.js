/**
 * Cloudflare Pages Function — GET /api/areas
 *
 * Lista todas as áreas de coleta disponíveis.
 * Útil para debug, integração com painéis administrativos
 * e validação dos dados pelo time de TI.
 *
 * Query params opcionais:
 *   ?tipo=seletiva         → apenas coleta seletiva (padrão)
 *   ?tipo=domiciliar       → apenas coleta domiciliar
 *   ?tipo=todos            → ambas as coletas
 *   ?bairro=BOTIATUVINHA   → filtra por bairro (case insensitive)
 */

let _cacheSeletiva = null;
let _cacheDomiciliar = null;

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const url = new URL(request.url);
    const tipo = url.searchParams.get('tipo') || 'seletiva';
    const filtroBairro = url.searchParams.get('bairro')?.toUpperCase() || null;

    const resultado = {};

    if (tipo === 'seletiva' || tipo === 'todos') {
      const data = await carregarGeoJSON('coleta_seletiva', request, env);
      resultado.seletiva = extrairAreas(data, filtroBairro);
    }

    if (tipo === 'domiciliar' || tipo === 'todos') {
      const data = await carregarGeoJSON('coleta_domiciliar', request, env);
      resultado.domiciliar = extrairAreas(data, filtroBairro);
    }

    // Totais
    const totais = {};
    for (const [chave, areas] of Object.entries(resultado)) {
      totais[chave] = areas.length;
    }

    return jsonResponse({
      filtros: { tipo, bairro: filtroBairro },
      totais,
      ...resultado,
    });

  } catch (err) {
    console.error('Erro na API /areas:', err);
    return jsonResponse({ erro: 'Erro interno.' }, 500);
  }
}

// ─────────────────────────────────────────────
// Carregar GeoJSON via ASSETS binding
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
// Extrair e formatar áreas
// ─────────────────────────────────────────────
function extrairAreas(geoData, filtroBairro) {
  if (!geoData?.features?.length) return [];

  return geoData.features
    .filter(f => {
      if (!filtroBairro) return true;
      return (f.properties.BAIRRO || '').toUpperCase().includes(filtroBairro);
    })
    .map(f => {
      const p = f.properties;
      return {
        bairro: p.BAIRRO || null,
        macro: p.MACRO || null,
        setor: p.Setor_2018 || null,
        frequencia: p.FREQUENCIA || p.frequencia || null,
        turno: p.TURNO || p.turno || null,
        horario: p.Horario || p.HORARIO || p.horario || null,
        operacao: p['OPERAÇÃO'] || p.operacao || null,
        vezes_por_semana: p.X_SEMANA ? parseInt(p.X_SEMANA) : null,
      };
    });
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

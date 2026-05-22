/**
 * Cloudflare Pages Function — GET /api/stats
 *
 * Retorna estatísticas de uso dos provedores de geocodificação
 * (Nominatim, Mapbox, Google) dos últimos 30 dias e meses correntes.
 *
 * Requer binding KV: COLETA_STATS
 */

export async function onRequest(context) {
  const { env } = context;

  if (!env.COLETA_STATS) {
    return jsonResponse({ erro: 'KV não configurado. Adicione o binding COLETA_STATS no Cloudflare Pages.' }, 503);
  }

  try {
    // Últimos 30 dias
    const dias = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push(d.toISOString().slice(0, 10));
    }

    // Meses envolvidos (pode ser 1 ou 2)
    const meses = [...new Set(dias.map(d => d.slice(0, 7)))];

    // Busca em paralelo
    const [dadosDiarios, dadosMensais] = await Promise.all([
      Promise.all(dias.map(async dia => {
        const d = await env.COLETA_STATS.get(`stats:${dia}`, 'json');
        return { dia, ...(d || { nominatim: 0, mapbox: 0, google: 0, not_found: 0, total: 0 }) };
      })),
      Promise.all(meses.map(async mes => {
        const d = await env.COLETA_STATS.get(`stats:${mes}`, 'json');
        return { mes, ...(d || { nominatim: 0, mapbox: 0, google: 0, not_found: 0, total: 0 }) };
      })),
    ]);

    // Totais dos últimos 30 dias
    const totais = dadosDiarios.reduce((acc, d) => {
      acc.nominatim  += d.nominatim  || 0;
      acc.mapbox     += d.mapbox     || 0;
      acc.google     += d.google     || 0;
      acc.not_found  += d.not_found  || 0;
      acc.total      += d.total      || 0;
      return acc;
    }, { nominatim: 0, mapbox: 0, google: 0, not_found: 0, total: 0 });

    return jsonResponse({
      periodo: { inicio: dias[0], fim: dias[dias.length - 1] },
      totais_30d: totais,
      diario: dadosDiarios,
      mensal: dadosMensais,
    });

  } catch (err) {
    console.error('Erro em /api/stats:', err);
    return jsonResponse({ erro: 'Erro interno.' }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

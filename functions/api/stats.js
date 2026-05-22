/**
 * Cloudflare Pages Function — GET /api/stats
 *
 * Retorna estatísticas de uso dos provedores de geocodificação
 * para Curitiba e Ribeirão Preto (últimos 30 dias + meses correntes).
 *
 * Requer binding KV: COLETA_STATS (compartilhado entre os dois projetos)
 */

const CIDADES = ['curitiba', 'ribeirao'];

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
    const meses = [...new Set(dias.map(d => d.slice(0, 7)))];

    // Busca em paralelo para todas as cidades
    const dadosPorCidade = {};
    await Promise.all(CIDADES.map(async cidade => {
      const [diario, mensal] = await Promise.all([
        Promise.all(dias.map(async dia => {
          const d = await env.COLETA_STATS.get(`stats:${cidade}:${dia}`, 'json');
          return { dia, ...(d || zero()) };
        })),
        Promise.all(meses.map(async mes => {
          const d = await env.COLETA_STATS.get(`stats:${cidade}:${mes}`, 'json');
          return { mes, ...(d || zero()) };
        })),
      ]);
      dadosPorCidade[cidade] = { diario, mensal, totais_30d: somar(diario) };
    }));

    // Consolidado (soma das duas cidades por dia)
    const consolidadoDiario = dias.map(dia => {
      const acc = { dia, ...zero() };
      for (const cidade of CIDADES) {
        const d = dadosPorCidade[cidade].diario.find(x => x.dia === dia) || zero();
        acc.nominatim += d.nominatim || 0;
        acc.mapbox    += d.mapbox    || 0;
        acc.google    += d.google    || 0;
        acc.not_found += d.not_found || 0;
        acc.total     += d.total     || 0;
      }
      return acc;
    });
    const consolidadoMensal = meses.map(mes => {
      const acc = { mes, ...zero() };
      for (const cidade of CIDADES) {
        const d = dadosPorCidade[cidade].mensal.find(x => x.mes === mes) || zero();
        acc.nominatim += d.nominatim || 0;
        acc.mapbox    += d.mapbox    || 0;
        acc.google    += d.google    || 0;
        acc.not_found += d.not_found || 0;
        acc.total     += d.total     || 0;
      }
      return acc;
    });

    return jsonResponse({
      periodo: { inicio: dias[0], fim: dias[dias.length - 1] },
      cidades: dadosPorCidade,
      consolidado: {
        totais_30d: somar(consolidadoDiario),
        diario: consolidadoDiario,
        mensal: consolidadoMensal,
      },
    });

  } catch (err) {
    console.error('Erro em /api/stats:', err);
    return jsonResponse({ erro: 'Erro interno.' }, 500);
  }
}

function zero() {
  return { nominatim: 0, mapbox: 0, google: 0, not_found: 0, total: 0 };
}

function somar(lista) {
  return lista.reduce((acc, d) => {
    acc.nominatim += d.nominatim || 0;
    acc.mapbox    += d.mapbox    || 0;
    acc.google    += d.google    || 0;
    acc.not_found += d.not_found || 0;
    acc.total     += d.total     || 0;
    return acc;
  }, zero());
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

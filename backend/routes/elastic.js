const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// 🔹 Configuración de Elasticsearch con Axios
const elasticConfig = {
  baseURL: process.env.ELASTIC_URL,
  auth: process.env.ELASTIC_USER && process.env.ELASTIC_PASS ? {
    username: process.env.ELASTIC_USER,
    password: process.env.ELASTIC_PASS
  } : undefined,
  timeout: 120000, // 2 minutos
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Configuración Elasticsearch con Axios:', {
  baseURL: elasticConfig.baseURL ? 'Configurado' : 'Falta ELASTIC_URL',
  hasAuth: !!elasticConfig.auth,
  timeout: elasticConfig.timeout
});

// 🔹 Función helper para hacer requests a Elasticsearch
async function elasticRequest(method, path, data = null) {
  try {
    const config = {
      method,
      url: path,
      ...elasticConfig
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      config.data = data;
    }

    console.log(`Elasticsearch ${method} ${path}`);
    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error en request Elasticsearch ${method} ${path}:`, error.message);
    if (error.response) {
      console.error('Respuesta de error:', error.response.status, error.response.data);
    }
    throw error;
  }
}

// 🔹 Endpoint para comparar ayer vs hoy
// ========================================
// GET /api/elastic/comparacion
// Obtener datos de elastic para el frontend
// ========================================
router.get('/comparacion', asyncHandler(async (req, res) => {
  try {
    // 🔹 Verificar que la configuración esté disponible
    if (!elasticConfig.baseURL) {
      return res.status(503).json({
        error: "Servicio Elasticsearch no disponible",
        message: "La configuración de Elasticsearch no es válida"
      });
    }

    const hoy = new Date().toISOString().split('T')[0];
    const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    console.log('Fechas calculadas:', { hoy, ayer });

    const query = {
      size: 0,
      query: {
        range: {
          "@timestamp": {
            gte: "now-1d/d",
            lte: "now/d",
          },
        },
      },
      runtime_mappings: {
        "state_keyword": {
          type: "keyword",
          script: {
            source: "try { if (params._source.catalog != null && params._source.catalog.stateDesc != null) { emit(params._source.catalog.stateDesc); } else { emit('SIN_ESTADO'); } } catch (Exception e) { emit('SIN_ESTADO'); }"
          }
        },
        "stretch_keyword": {
          type: "keyword",
          script: {
            source: "try { if (params._source.catalog != null && params._source.catalog.stretchDesc != null) { emit(params._source.catalog.stretchDesc); } else { emit('SIN_TRAMO'); } } catch (Exception e) { emit('SIN_TRAMO'); }"
          }
        },
        "speed_num": {
          type: "double",
          script: {
            source: "try { if (params._source.attributes != null && params._source.attributes.speed != null) { def val = params._source.attributes.speed; if (val instanceof String) { emit(Double.parseDouble(val)); } else if (val instanceof Number) { emit(val.doubleValue()); } else { emit(0.0); } } else { emit(0.0); } } catch (Exception e) { emit(0.0); }"
          }
        }
      },
      aggs: {
        por_dia: {
          date_histogram: {
            field: "@timestamp",
            calendar_interval: "day",
            format: "yyyy-MM-dd",
          },
          aggs: {
            por_estado: {
              terms: { field: "state_keyword", size: 100 },
              aggs: {
                por_tramo: {
                  terms: { field: "stretch_keyword", size: 100 },
                  aggs: {
                    cantidad_registros: {
                      value_count: { field: "speed_num" },
                    },
                    velocidad_promedio: {
                      avg: { field: "speed_num" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    console.log('Ejecutando consulta Elasticsearch con query:', JSON.stringify(query, null, 2));

    const response = await elasticRequest('POST', '/neural.plates.output-*/_search', query);
    console.log(response._shards.failures)
    console.log('Respuesta de Elasticsearch:', {
      took: response.took,
      totalHits: response.hits?.total?.value || response.hits?.total || 0,
      hasAggregations: !!response.aggregations,
      hasPorDia: !!response.aggregations?.por_dia,
      aggregationsKeys: response.aggregations ? Object.keys(response.aggregations) : []
    });

    // 🔹 Log detallado de la respuesta para debugging
    if (response.aggregations) {
      console.log('Estructura de aggregations:', JSON.stringify(response.aggregations, null, 2));
    } else {
      console.log('No hay aggregations en la respuesta');
    }

    // 🔹 Validar respuesta
    if (!response.aggregations || !response.aggregations.por_dia) {
      console.log('No se encontraron agregaciones por_dia en la respuesta');
      return res.status(404).json({ error: "No se encontraron datos en Elasticsearch" });
    }

    // 🔹 Procesar la respuesta de Elasticsearch
    const data = [];
    const buckets = response.aggregations.por_dia.buckets;

    console.log(`Procesando ${buckets.length} buckets de días`);

    for (const dia of buckets) {
      const fecha = dia.key_as_string;
      console.log(`Procesando día: ${fecha}, estados: ${dia.por_estado?.buckets?.length || 0}`);

      if (dia.por_estado && dia.por_estado.buckets) {
        for (const estado of dia.por_estado.buckets) {
          console.log(`  Estado: ${estado.key}, tramos: ${estado.por_tramo?.buckets?.length || 0}`);

          if (estado.por_tramo && estado.por_tramo.buckets) {
            for (const tramo of estado.por_tramo.buckets) {
              const cantidad = tramo.cantidad_registros ? tramo.cantidad_registros.value : 0;
              const velocidad = tramo.velocidad_promedio && tramo.velocidad_promedio.value
                ? parseFloat(tramo.velocidad_promedio.value.toFixed(2))
                : 0;

              data.push({
                fecha,
                estado: estado.key,
                tramo: tramo.key,
                cantidad,
                velocidad_promedio: velocidad,
              });

              console.log(`    Tramo: ${tramo.key}, cantidad: ${cantidad}, velocidad: ${velocidad}`);
            }
          }
        }
      }
    }

    console.log(`Total de registros procesados: ${data.length}`);

    // 🔹 Convertir a tabla comparativa
    const fechas = [...new Set(data.map((d) => d.fecha))].sort();
    console.log('Fechas únicas encontradas:', fechas);

    // if (fechas.length !== 2) {
    //   console.log(`Se esperaban 2 fechas pero se encontraron ${fechas.length}`);
    //   return res.status(400).json({ error: "No se encontraron exactamente 2 días en los datos." });
    // }

    const [fAyer, fHoy] = fechas;
    const map = {};

    console.log(`Mapeando datos para fechas: ayer=${fAyer}, hoy=${fHoy}`);

    for (const d of data) {
      const key = `${d.estado}_${d.tramo}`;
      if (!map[key]) map[key] = { estado: d.estado, tramo: d.tramo };
      map[key][`cantidad_${d.fecha}`] = d.cantidad;
      map[key][`velocidad_promedio_${d.fecha}`] = d.velocidad_promedio;
    }

    console.log(`Total de combinaciones estado-tramo: ${Object.keys(map).length}`);

    // 🔹 Calcular diferencia
    const result = Object.values(map).map((r) => ({
      estado: r.estado,
      tramo: r.tramo,
      [`cantidad_${fAyer}`]: r[`cantidad_${fAyer}`] || 0,
      [`velocidad_promedio_${fAyer}`]: r[`velocidad_promedio_${fAyer}`] || 0,
      [`cantidad_${fHoy}`]: r[`cantidad_${fHoy}`] || 0,
      [`velocidad_promedio_${fHoy}`]: r[`velocidad_promedio_${fHoy}`] || 0,
      diferencia_promedio:
        (r[`velocidad_promedio_${fHoy}`] || 0) - (r[`velocidad_promedio_${fAyer}`] || 0),
    }));

    console.log(`Resultado final: ${result.length} registros`);

    res.json({
      fechas: { ayer: fAyer, hoy: fHoy },
      total_tramos: result.length,
      data: result,
    });
  } catch (err) {
    console.error('Error en consulta Elasticsearch:', err);
    res.status(500).json({
      error: "Error al consultar Elasticsearch",
      details: err.message
    });
  }
}));

module.exports = router;

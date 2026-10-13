import { jest } from '@jest/globals';
import { optimizeEuclidean, optimizeWithOSRM, optimizeWithGoogleMaps, calculateRouteSequence } from '../src/routing.js';

describe('Logistics Routing Service', () => {
  const depot = { latitude: -23.55052, longitude: -46.633308 };

  const points = [
    { id: 'p1', latitude: -23.560000, longitude: -46.640000 },
    { id: 'p2', latitude: -23.551000, longitude: -46.634000 }, // Mais perto do depósito
    { id: 'p3', latitude: -23.590000, longitude: -46.680000 }  // Mais longe
  ];

  describe('optimizeEuclidean', () => {
    it('deve ordenar pelo vizinho mais próximo a partir do depósito', () => {
      const res = optimizeEuclidean(depot, points);
      expect(res.source).toBe('euclidean');
      expect(res.orderedPoints[0].id).toBe('p2');
      expect(res.orderedPoints.length).toBe(3);
    });
  });

  describe('optimizeWithOSRM (OpenStreetMap)', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('deve ordenar corretamente os pontos baseado em waypoint_index do OSRM', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 'Ok',
          trips: [
            {
              distance: 14750, // 14.75 km
              duration: 1800   // 30 min
            }
          ],
          waypoints: [
            { waypoint_index: 0 }, // Depósito
            { waypoint_index: 2 }, // p1 (segunda entrega)
            { waypoint_index: 1 }, // p2 (primeira entrega)
            { waypoint_index: 3 }  // p3 (terceira entrega)
          ]
        })
      });

      const res = await optimizeWithOSRM(depot, points);
      expect(res.source).toBe('openstreetmap');
      expect(res.orderedPoints[0].id).toBe('p2');
      expect(res.orderedPoints[1].id).toBe('p1');
      expect(res.orderedPoints[2].id).toBe('p3');
      expect(res.distanceKm).toBe(14.75);
      expect(res.estimatedMinutes).toBe(30);
    });

    it('deve fazer fallback para euclidiano se o OSRM retornar erro ou falhar', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Servidor indisponível'));

      const res = await optimizeWithOSRM(depot, points);
      expect(res.source).toBe('euclidean');
      expect(res.orderedPoints[0].id).toBe('p2');
    });
  });

  describe('optimizeWithGoogleMaps', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('deve ordenar corretamente a partir de waypoint_order retornado pelo Google Maps', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          status: 'OK',
          routes: [
            {
              waypoint_order: [1, 0, 2], // P2, P1, P3
              legs: [
                { distance: { value: 1200 }, duration: { value: 240 } },
                { distance: { value: 2500 }, duration: { value: 480 } },
                { distance: { value: 6000 }, duration: { value: 900 } }
              ]
            }
          ]
        })
      });

      const res = await optimizeWithGoogleMaps(depot, points, 'FAKE_KEY');
      expect(res.source).toBe('google_maps');
      expect(res.orderedPoints[0].id).toBe('p2');
      expect(res.orderedPoints[1].id).toBe('p1');
      expect(res.orderedPoints[2].id).toBe('p3');
      expect(res.distanceKm).toBe(9.7);
      expect(res.estimatedMinutes).toBe(27);
    });

    it('deve fazer fallback para euclidiano em caso de chave inválida ou erro', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({
          status: 'REQUEST_DENIED',
          error_message: 'The provided API key is invalid.'
        })
      });

      const res = await optimizeWithGoogleMaps(depot, points, 'INVALID_KEY');
      expect(res.source).toBe('euclidean');
      expect(res.orderedPoints[0].id).toBe('p2');
    });
  });

  describe('calculateRouteSequence', () => {
    it('deve posicionar pedidos sem coordenadas no fim da fila e usar OpenStreetMap por padrão', async () => {
      const orders = [
        { id: 'o-sem-coord', latitude: null, longitude: null },
        { id: 'p2', latitude: -23.551000, longitude: -46.634000 },
        { id: 'p1', latitude: -23.560000, longitude: -46.640000 }
      ];

      const res = await calculateRouteSequence(orders, depot.latitude, depot.longitude);
      expect(res.ordered.length).toBe(3);
      expect(res.ordered[res.ordered.length - 1].id).toBe('o-sem-coord');
    });
  });
});

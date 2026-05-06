import { buildYandexMapHtml } from '@/map/yandexMapHtml';

describe('buildYandexMapHtml', () => {
  it('injects apikey into Yandex script URL', () => {
    const html = buildYandexMapHtml('test-api-key-123');
    expect(html).toContain('api-maps.yandex.ru/v3/');
    expect(html).toContain('apikey=test-api-key-123');
    expect(html).toContain('window.__rnBridge');
    expect(html).toContain('getViewport');
    expect(html).toContain('setMarkers');
    expect(html).toContain('registerCdn');
    expect(html).toContain('jsdelivr.net/npm');
    expect(html).toContain('@yandex/ymaps3-default-ui-theme');
  });
});

import { templates } from '../templates';

describe('templates', () => {
  it('keeps gateway details when response time is present', () => {
    const result = templates.gatewayHealth(0, 'response: 120ms\nendpoint: /health\nstatus: ok');

    expect(result.text).toContain('响应时间: 120ms');
    expect(result.text).toContain('endpoint: /health');
    expect(result.text).toContain('status: ok');
  });

  it('falls back to raw status details when key fields cannot be extracted', () => {
    const result = templates.statusOverview(true, undefined, undefined, 'service mode active\nbuild abc123');

    expect(result.text).toContain('运行状态: ✅ 运行中');
    expect(result.text).toContain('service mode active');
    expect(result.text).toContain('build abc123');
  });
});

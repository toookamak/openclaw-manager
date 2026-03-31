import { parseStatus, parseHealthJson, parseModelsList, parseCronJobs, parseErrorSummary, truncateOutput } from '../parser';

describe('parseStatus', () => {
  it('parses running status correctly', () => {
    const output = 'Status: Running\nVersion: v1.2.3\nUptime: 3d 14h 22m\nPID: 12345';
    const result = parseStatus(output);
    expect(result.running).toBe(true);
    expect(result.version).toBe('v1.2.3');
    expect(result.uptime).toBe('3d 14h 22m');
    expect(result.pid).toBe('12345');
  });

  it('parses active status as running', () => {
    const output = 'State: Active\nVersion: 2.0.0';
    const result = parseStatus(output);
    expect(result.running).toBe(true);
  });

  it('parses stopped status as not running', () => {
    const output = 'State: Stopped\nVersion: 2.0.0';
    const result = parseStatus(output);
    expect(result.running).toBe(false);
  });

  it('handles output without version or uptime', () => {
    const output = 'Status: Running';
    const result = parseStatus(output);
    expect(result.running).toBe(true);
    expect(result.version).toBeUndefined();
    expect(result.uptime).toBeUndefined();
    expect(result.pid).toBeUndefined();
  });

  it('returns raw output', () => {
    const output = 'Status: Running\nVersion: 1.0';
    const result = parseStatus(output);
    expect(result.raw).toBe(output);
  });

  it('extracts PID from various formats', () => {
    const output1 = 'PID: 9999\nStatus: Running';
    expect(parseStatus(output1).pid).toBe('9999');

    const output2 = 'pid: 42';
    expect(parseStatus(output2).pid).toBe('42');
  });
});

describe('parseHealthJson', () => {
  it('parses healthy JSON correctly', () => {
    const json = JSON.stringify({
      healthy: true,
      gateway: { healthy: true },
      providers: { openai: true },
    });
    const result = parseHealthJson(json);
    expect(result.healthy).toBe(true);
    expect(result.gateway).toBe(true);
  });

  it('handles status ok format', () => {
    const json = JSON.stringify({ status: 'ok', gateway: { status: 'ok' } });
    const result = parseHealthJson(json);
    expect(result.healthy).toBe(true);
    expect(result.gateway).toBe(true);
  });

  it('handles unhealthy JSON', () => {
    const json = JSON.stringify({ healthy: false, gateway: { healthy: false } });
    const result = parseHealthJson(json);
    expect(result.healthy).toBe(false);
    expect(result.gateway).toBe(false);
  });

  it('returns raw output on invalid JSON', () => {
    const result = parseHealthJson('not json');
    expect(result.healthy).toBe(false);
    expect(result.gateway).toBe(false);
    expect(result.details).toBe('not json');
  });
});

describe('parseModelsList', () => {
  it('parses model names from output', () => {
    const output = 'gpt-4o\nclaude-3.5-sonnet\ngemini-pro';
    const result = parseModelsList(output);
    expect(result).toEqual(['gpt-4o', 'claude-3.5-sonnet', 'gemini-pro']);
  });

  it('filters out comment lines', () => {
    const output = '# Available models\ngpt-4o\n# Default';
    const result = parseModelsList(output);
    expect(result).toEqual(['gpt-4o']);
  });

  it('filters out dash-prefixed lines', () => {
    const output = '- gpt-4o\n- claude-3';
    const result = parseModelsList(output);
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(parseModelsList('')).toEqual([]);
    expect(parseModelsList('\n\n')).toEqual([]);
  });
});

describe('parseCronJobs', () => {
  it('parses cron jobs from tabular output', () => {
    const output = 'job-01  Backup Daily  0 2 * * *  enabled\njob-02  Health Check  */5 * * * *  disabled';
    const result = parseCronJobs(output);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'job-01',
      name: 'Backup Daily',
      schedule: '0 2 * * *',
      enabled: true,
    });
    expect(result[1]).toEqual({
      id: 'job-02',
      name: 'Health Check',
      schedule: '*/5 * * * *',
      enabled: false,
    });
  });

  it('returns empty array for malformed lines', () => {
    const output = 'single-column-only';
    expect(parseCronJobs(output)).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    expect(parseCronJobs('')).toEqual([]);
  });
});

describe('parseErrorSummary', () => {
  it('filters error and warn lines', () => {
    const output = 'INFO normal log\nERROR something broke\nWARN disk space low\nFATAL crash';
    const result = parseErrorSummary(output);
    expect(result).toEqual([
      'ERROR something broke',
      'WARN disk space low',
      'FATAL crash',
    ]);
  });

  it('limits to 20 results', () => {
    const lines = Array(30).fill('ERROR test').join('\n');
    const result = parseErrorSummary(lines);
    expect(result).toHaveLength(20);
  });

  it('returns empty array when no errors', () => {
    expect(parseErrorSummary('INFO all good')).toEqual([]);
  });
});

describe('truncateOutput', () => {
  it('returns original if within limit', () => {
    const text = 'short text';
    expect(truncateOutput(text, 100)).toBe(text);
  });

  it('truncates and appends marker if over limit', () => {
    const text = 'a'.repeat(100);
    const result = truncateOutput(text, 50);
    expect(result.length).toBeLessThanOrEqual(50 + '\n... (truncated)'.length);
    expect(result).toContain('... (truncated)');
  });

  it('uses default maxLen of 3500', () => {
    const text = 'a'.repeat(4000);
    const result = truncateOutput(text);
    expect(result.length).toBeLessThan(4000);
  });
});

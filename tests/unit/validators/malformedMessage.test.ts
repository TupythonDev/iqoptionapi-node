import { parseIncomingMessage } from '../../../src/validators/messageSchema';
import { MalformedMessageHandler } from '../../../src/validators/malformedMessage';

describe('parseIncomingMessage', () => {
  it('returns a parsed message for valid envelope', () => {
    const msg = parseIncomingMessage('{"name":"heartbeat","msg":{}}');
    expect(msg).not.toBeNull();
    expect(msg?.name).toBe('heartbeat');
  });

  it('returns null for malformed JSON', () => {
    expect(parseIncomingMessage('{bad json}')).toBeNull();
  });

  it('returns null when name field is missing', () => {
    expect(parseIncomingMessage('{"msg":{}}')).toBeNull();
  });

  it('returns null when name is empty string', () => {
    expect(parseIncomingMessage('{"name":"","msg":{}}')).toBeNull();
  });

  it('returns null when msg field is missing', () => {
    expect(parseIncomingMessage('{"name":"heartbeat"}')).toBeNull();
  });

  it('returns null for a plain array', () => {
    expect(parseIncomingMessage('[1,2,3]')).toBeNull();
  });

  it('returns null for a primitive value', () => {
    expect(parseIncomingMessage('"string"')).toBeNull();
    expect(parseIncomingMessage('42')).toBeNull();
  });

  it('never throws', () => {
    const inputs = ['{bad', '', 'null', 'undefined', '{}'];
    for (const input of inputs) {
      expect(() => parseIncomingMessage(input)).not.toThrow();
    }
  });
});

describe('MalformedMessageHandler', () => {
  const handler = new MalformedMessageHandler();

  it('returns ok=true for valid message', () => {
    const result = handler.parse('{"name":"heartbeat","msg":{}}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.name).toBe('heartbeat');
  });

  it('returns ok=false with ParseError for invalid message', () => {
    const result = handler.parse('{bad json}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.raw).toBe('{bad json}');
      expect(result.error.reason).toBeTruthy();
    }
  });
});

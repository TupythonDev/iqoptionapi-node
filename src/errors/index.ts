export class IQOptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IQOptionError';
  }
}

export class AuthenticationError extends IQOptionError {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ConnectionError extends IQOptionError {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class ProtocolError extends IQOptionError {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

export class TradingError extends IQOptionError {
  constructor(message: string) {
    super(message);
    this.name = 'TradingError';
  }
}

export class ValidationError extends IQOptionError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class TimeoutError extends IQOptionError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

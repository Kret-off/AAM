/**
 * Base Error Class
 * All application errors should extend this class
 */

export class BaseError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean; // True if error is expected/handled

  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}


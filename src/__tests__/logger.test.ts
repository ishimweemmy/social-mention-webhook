import logger from '../utils/logger';

// Mock winston
jest.mock('winston', () => ({
    format: {
        printf: jest.fn().mockReturnValue({}),
        combine: jest.fn().mockReturnValue({}),
        timestamp: jest.fn().mockReturnValue({}),
        colorize: jest.fn().mockReturnValue({}),
    },
    createLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    }),
    transports: {
        Console: jest.fn(),
        File: jest.fn(),
    },
}));

describe('Logger', () => {
    it('should export a logger object', () => {
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
    });
});
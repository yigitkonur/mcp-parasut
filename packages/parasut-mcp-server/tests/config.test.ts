import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, validateConfig, type ServerConfig } from '../src/config.js';
import { initializeClient, getClient, resetClient } from '../src/client.js';

describe('Config Loading & Validation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear relevant environment variables before each test
    delete process.env['PARASUT_COMPANY_ID'];
    delete process.env['PARASUT_CLIENT_ID'];
    delete process.env['PARASUT_CLIENT_SECRET'];
    delete process.env['PARASUT_USERNAME'];
    delete process.env['PARASUT_PASSWORD'];
    delete process.env['PARASUT_ACCESS_TOKEN'];
    delete process.env['PARASUT_REFRESH_TOKEN'];
    delete process.env['PARASUT_BASE_URL'];
    delete process.env['DEBUG'];
    resetClient();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetClient();
  });

  describe('loadConfig', () => {
    it('throws if neither token nor credentials are provided', () => {
      process.env['PARASUT_COMPANY_ID'] = '12345';
      assert.throws(
        () => loadConfig(),
        /At least one authentication method must be provided/
      );
    });

    it('loads successfully with PARASUT_ACCESS_TOKEN without username/password', () => {
      process.env['PARASUT_COMPANY_ID'] = '12345';
      process.env['PARASUT_ACCESS_TOKEN'] = 'test-access-token';

      const config = loadConfig();
      assert.equal(config.parasut.companyId, 12345);
      assert.equal(config.parasut.accessToken, 'test-access-token');
      assert.equal(config.parasut.username, undefined);
      assert.equal(config.parasut.password, undefined);
    });

    it('loads successfully with PARASUT_REFRESH_TOKEN without username/password', () => {
      process.env['PARASUT_COMPANY_ID'] = '12345';
      process.env['PARASUT_REFRESH_TOKEN'] = 'test-refresh-token';

      const config = loadConfig();
      assert.equal(config.parasut.companyId, 12345);
      assert.equal(config.parasut.refreshToken, 'test-refresh-token');
      assert.equal(config.parasut.username, undefined);
      assert.equal(config.parasut.password, undefined);
    });

    it('loads successfully with username and password credentials', () => {
      process.env['PARASUT_COMPANY_ID'] = '12345';
      process.env['PARASUT_CLIENT_ID'] = 'client-id';
      process.env['PARASUT_CLIENT_SECRET'] = 'client-secret';
      process.env['PARASUT_USERNAME'] = 'user@example.com';
      process.env['PARASUT_PASSWORD'] = 'secret-pass';

      const config = loadConfig();
      assert.equal(config.parasut.companyId, 12345);
      assert.equal(config.parasut.clientId, 'client-id');
      assert.equal(config.parasut.clientSecret, 'client-secret');
      assert.equal(config.parasut.username, 'user@example.com');
      assert.equal(config.parasut.password, 'secret-pass');
    });

    it('parses PARASUT_COMPANY_ID as integer when present', () => {
      process.env['PARASUT_COMPANY_ID'] = '9876';
      process.env['PARASUT_ACCESS_TOKEN'] = 'token';

      const config = loadConfig();
      assert.strictEqual(config.parasut.companyId, 9876);
    });

    it('allows missing PARASUT_COMPANY_ID in loadConfig', () => {
      process.env['PARASUT_ACCESS_TOKEN'] = 'token';

      const config = loadConfig();
      assert.strictEqual(config.parasut.companyId, undefined);
    });

    it('throws if PARASUT_COMPANY_ID is not a valid integer', () => {
      process.env['PARASUT_COMPANY_ID'] = 'not-an-int';
      process.env['PARASUT_ACCESS_TOKEN'] = 'token';

      assert.throws(
        () => loadConfig(),
        /Environment variable PARASUT_COMPANY_ID must be a valid integer/
      );
    });
  });

  describe('validateConfig', () => {
    it('validates token-based config successfully', () => {
      const config: ServerConfig = {
        parasut: {
          companyId: 12345,
          accessToken: 'my-token',
        },
        debug: false,
      };

      assert.doesNotThrow(() => validateConfig(config));
    });

    it('validates password-credentials config successfully', () => {
      const config: ServerConfig = {
        parasut: {
          companyId: 12345,
          clientId: 'cid',
          clientSecret: 'csec',
          username: 'u@example.com',
          password: 'pwd',
        },
        debug: false,
      };

      assert.doesNotThrow(() => validateConfig(config));
    });

    it('throws if neither auth method is provided', () => {
      const config: ServerConfig = {
        parasut: {
          companyId: 12345,
        },
        debug: false,
      };

      assert.throws(
        () => validateConfig(config),
        /At least one authentication method must be provided/
      );
    });

    it('throws if companyId is <= 0', () => {
      const config: ServerConfig = {
        parasut: {
          companyId: 0,
          accessToken: 'my-token',
        },
        debug: false,
      };

      assert.throws(
        () => validateConfig(config),
        /PARASUT_COMPANY_ID must be a positive integer/
      );
    });

    it('throws if username is empty when using password credentials', () => {
      const config: ServerConfig = {
        parasut: {
          companyId: 12345,
          clientId: 'cid',
          clientSecret: 'csec',
          username: '   ',
          password: 'pwd',
        },
        debug: false,
      };

      assert.throws(
        () => validateConfig(config),
        /PARASUT_USERNAME cannot be empty/
      );
    });
  });

  describe('initializeClient', () => {
    it('initializes client with access token', () => {
      const client = initializeClient({
        companyId: 12345,
        accessToken: 'bearer-test-token',
      });

      assert.ok(client);
      assert.strictEqual(getClient(), client);
    });

    it('initializes client with credentials and refresh token', () => {
      resetClient();
      const client = initializeClient({
        companyId: 12345,
        clientId: 'cid',
        clientSecret: 'csec',
        username: 'u@example.com',
        password: 'pwd',
        refreshToken: 'rt-123',
      });

      assert.ok(client);
      assert.strictEqual(getClient(), client);
    });
  });
});

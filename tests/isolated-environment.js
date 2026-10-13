import NodeEnvironment from 'jest-environment-node';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export default class IsolatedEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    const suite = path.basename(context.testPath, '.test.js');
    this.storageDir = path.join(os.tmpdir(), 'xiquim-vargas-jest', `${suite}-${randomUUID()}`);
  }

  async setup() {
    await super.setup();
    this.global.process.env.STORAGE_DIR = this.storageDir;
    this.global.process.env.NODE_ENV = 'test';
    this.global.process.env.JWT_SECRET = 'jest-only-secret-do-not-use-in-production';
  }
}

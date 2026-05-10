import { relative } from 'node:path';
import { getIndexSprite16 } from '../src/index.js';

const VERSION = 'v1';

const path = await getIndexSprite16(VERSION, {
  onProgress: (done, total) => {
    process.stdout.write(`\r  extracting ${done}/${total}`);
    if (done === total) process.stdout.write('\n');
  },
});

console.log(`Index sprite: ${relative(process.cwd(), path)}`);

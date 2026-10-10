import fs from 'fs';
import path from 'path';

const dir = 'packages/sdk/src';
const files = fs.readdirSync(dir);
for (const file of files) {
  if (file.endsWith('.ts')) {
    const p = path.join(dir, file);
    let content = fs.readFileSync(p, 'utf8');
    if (content.includes('\\n')) {
      content = content.replace(/\\n/g, '\n');
      fs.writeFileSync(p, content);
      console.log(`Fixed ${file}`);
    }
  }
}

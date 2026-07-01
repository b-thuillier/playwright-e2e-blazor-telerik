const { existsSync, mkdirSync, cpSync } = require('fs');
const { join } = require('path');

console.log('Current directory:', process.cwd());
console.log('playwright-report exists:', existsSync('playwright-report'));

const now = new Date();
const date = now.getFullYear() + '-' +
  String(now.getMonth() + 1).padStart(2, '0') + '-' +
  String(now.getDate()).padStart(2, '0') + '_' +
  String(now.getHours()).padStart(2, '0') + '-' +
  String(now.getMinutes()).padStart(2, '0') + '-' +
  String(now.getSeconds()).padStart(2, '0');
const outputFolder = join('archived-reports', date);

if (existsSync('playwright-report')) {
  mkdirSync(outputFolder, { recursive: true });
  cpSync('playwright-report', outputFolder, { recursive: true });
  console.log(`\n✔ Report saved: ${outputFolder}`);
} else {
  console.log('\n⚠ playwright-report folder not found');
}
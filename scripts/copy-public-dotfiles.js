const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const buildDir = path.join(projectRoot, 'build');
const filesToCopy = ['.htaccess'];

filesToCopy.forEach((fileName) => {
  const sourcePath = path.join(publicDir, fileName);
  const targetPath = path.join(buildDir, fileName);

  if (!fs.existsSync(sourcePath) || !fs.existsSync(buildDir)) {
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
  console.log(`Copied ${fileName} to build output.`);
});

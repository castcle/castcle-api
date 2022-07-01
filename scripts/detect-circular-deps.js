const madge = require('madge');
const { getJestProjects } = require('@nrwl/jest');

async function detectCircularDeps() {
  const apps = getJestProjects()
    .filter((path) => /\/apps\//.test(path))
    .map((path) => path.replace('<rootDir>/', '') + '/src/main.ts');

  const madgeResponse = await madge(apps, {
    tsConfig: 'tsconfig.base.json',
    excludeRegExp: [/index.ts/],
  });

  const circularDeps = madgeResponse.circular();

  console.log({ circularDeps, totalCircularDeps: circularDeps.length });
  process.exit(circularDeps.length ? 1 : 0);
}

detectCircularDeps();

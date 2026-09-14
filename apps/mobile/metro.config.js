const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm já symlinka @studyquest/shared para dentro de apps/mobile/node_modules,
// então a resolução hierárquica padrão do Metro funciona sem alterações.
// Só precisamos que o watcher enxergue o alvo do symlink (fora de apps/mobile)
// para o Fast Refresh detectar mudanças no pacote compartilhado.
config.watchFolders = [workspaceRoot];

module.exports = config;

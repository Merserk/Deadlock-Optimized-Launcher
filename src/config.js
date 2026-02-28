const fs = require('fs');
const path = require('path');

const CONFIG_FILE_NAME = 'deadlock_launcher_config.json';
const LEGACY_CONFIG_FILE_NAME = 'deadlock_launcher_config.ini';

function defaultConfig() {
    return { LauncherPath: null };
}

function getConfigPaths(app) {
    const userDataPath = app.getPath('userData');
    return {
        configFile: path.join(userDataPath, CONFIG_FILE_NAME),
        legacyConfigFile: path.join(userDataPath, LEGACY_CONFIG_FILE_NAME)
    };
}

function parseLegacyIniValue(rawValue) {
    const value = rawValue.trim();
    if (/^true$/i.test(value)) return true;
    if (/^false$/i.test(value)) return false;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    return value;
}

function parseLegacyIni(content) {
    const result = {};
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith(';') || line.startsWith('#')) continue;
        if (line.startsWith('[') && line.endsWith(']')) continue;

        const equalsIndex = line.indexOf('=');
        if (equalsIndex === -1) continue;

        const key = line.slice(0, equalsIndex).trim();
        const rawValue = line.slice(equalsIndex + 1);
        if (!key) continue;

        result[key] = parseLegacyIniValue(rawValue);
    }
    return result;
}

function cleanupLegacyConfig(legacyConfigFile) {
    if (!legacyConfigFile || !fs.existsSync(legacyConfigFile)) return;
    try {
        fs.rmSync(legacyConfigFile, { force: true });
    } catch (cleanupError) {
        console.warn('Legacy INI cleanup failed', cleanupError);
    }
}

function loadConfig(app) {
    const { configFile, legacyConfigFile } = getConfigPaths(app);

    try {
        if (fs.existsSync(configFile)) {
            const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
            if (config && typeof config === 'object') {
                return config;
            }
        }

        if (fs.existsSync(legacyConfigFile)) {
            const legacyContent = fs.readFileSync(legacyConfigFile, 'utf-8');
            const migratedConfig = parseLegacyIni(legacyContent);
            const finalConfig = { ...defaultConfig(), ...migratedConfig };
            fs.writeFileSync(configFile, JSON.stringify(finalConfig, null, 2), 'utf-8');
            cleanupLegacyConfig(legacyConfigFile);
            return finalConfig;
        }
    } catch (error) {
        console.error('Config load error', error);
    }

    return defaultConfig();
}

function saveConfig(app, config) {
    const { configFile, legacyConfigFile } = getConfigPaths(app);

    try {
        const normalized = (config && typeof config === 'object') ? config : defaultConfig();
        fs.writeFileSync(configFile, JSON.stringify(normalized, null, 2), 'utf-8');
        cleanupLegacyConfig(legacyConfigFile);
        return true;
    } catch (error) {
        console.error('Config save error', error);
        return false;
    }
}

module.exports = {
    defaultConfig,
    getConfigPaths,
    loadConfig,
    saveConfig
};
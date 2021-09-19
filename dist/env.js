"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setEnv = void 0;
const config_1 = require("./config");
function setEnv(env) {
    switch (env) {
        case 'staging':
            (0, config_1.setServiceUrl)('https://dappstarter-api-staging.decentology.com');
            break;
        case 'development':
        case 'dev':
            (0, config_1.setServiceUrl)('http://localhost:6001');
            break;
        case 'production':
        case 'prod':
            (0, config_1.setServiceUrl)('https://dappstarter-api.decentology.com');
            break;
    }
}
exports.setEnv = setEnv;
//# sourceMappingURL=env.js.map
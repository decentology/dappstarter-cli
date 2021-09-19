"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setEnv = void 0;
const constants_1 = require("./constants");
function setEnv(env) {
    switch (env) {
        case 'staging':
            (0, constants_1.setServiceUrl)('https://dappstarter-api-staging.decentology.com');
            break;
        case 'development':
        case 'dev':
            (0, constants_1.setServiceUrl)('http://localhost:6001');
            break;
        case 'production':
        case 'prod':
            (0, constants_1.setServiceUrl)('https://dappstarter-api.decentology.com');
            break;
    }
}
exports.setEnv = setEnv;
//# sourceMappingURL=env.js.map
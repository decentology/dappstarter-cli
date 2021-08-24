import { setServiceUrl } from './constants';
export function setEnv(
	env: 'production' | 'prod' | 'staging' | 'development' | 'dev'
) {
	switch (env) {
		case 'staging':
			setServiceUrl('https://dappstarter-api-staging.decentology.com');
			break;
		case 'development' || 'dev':
			setServiceUrl('http://localhost:6001');
			break;
		case 'production' || 'prod':
			setServiceUrl('https://dappstarter-api.decentology.com');
			break;
	}
}

import { setServiceUrl } from './config';
export function setEnv(
	env: 'production' | 'prod' | 'staging' | 'development' | 'dev'
) {
	switch (env) {
		case 'staging':
			setServiceUrl('https://dappstarter-api-staging.decentology.com');
			break;
		case 'development':
		case 'dev':
			setServiceUrl('http://localhost:6001');
			break;
		case 'production':
		case 'prod':
			setServiceUrl('https://dappstarter-api.decentology.com');
			break;
	}
}

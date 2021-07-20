import { setServiceUrl } from './constants'
export function setEnv(env: 'production' | 'staging' | 'development') {
	switch (env) {
		case 'staging':
			setServiceUrl('https://dappstarter-api-staging.centralus.cloudapp.azure.com');
			break;
	}
}

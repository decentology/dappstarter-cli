import isReachable from 'is-reachable';
import { defer, interval, lastValueFrom, mergeMap, takeWhile, tap } from 'rxjs';


(async () => {
	await lastValueFrom(interval(1000).pipe(
		mergeMap(() =>
			defer(async () => await isReachable('dappstarter-cli-node-2207694351.centralus.cloudapp.azure.com:22'))
		),
		tap((x) => console.log(x)),
		takeWhile(x => !x))
	);
})();

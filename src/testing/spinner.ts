import ora from 'ora';
import humanizer from 'humanize-duration';

let counter = new Date().getTime();
let text = () =>
	`Creating container... ${humanizer(new Date().getTime() - counter, {
		maxDecimalPoints: 1,
	})}`;
const spinner = ora(text()).start();

let timer = setInterval(() => ((spinner.text = text()), 1000));

setTimeout(() => {
	clearInterval(timer);
	spinner.stop();
}, 35000);

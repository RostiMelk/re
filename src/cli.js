const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const { AutoComplete } = require('enquirer');
const { spawn } = require('child_process');

dotenv.config({
	path: path.resolve(__dirname, '../.env'),
});

const workingDir = process.cwd();
const toDir = workingDir.split('/').slice(1);

class Selector extends AutoComplete {
	constructor(options = {}) {
		super(options);
	}

	async keypress(input, event = {}) {
		if (event.name === 'tab') {
			super.close();
			super.clear();

			// Get the limit from the original prompt
			const limit = this.options.limit;

			// Handle reverse tab
			if (event.shift === true) {
				toDir.pop();
				const selection = await directoryPrompt(path.join('/', ...toDir), limit);
				cd(path.join('/', ...toDir, selection));
				return;
			}

			// Continue tabbing
			if (fs.lstatSync(path.join('/', ...toDir, this.selected.name)).isDirectory()) {
				// If the tabbed item is a directory,
				// we want to add it to the toDir array and show a new prompt
				toDir.push(this.selected.name);
				const selection = await directoryPrompt(path.join('/', ...toDir), limit);
				cd(path.join('/', ...toDir, selection));
			} else {
				open(path.join('/', ...toDir, this.selected.name)); // Open file if it's not a directory
			}
			return;
		}
		super.keypress(input, event);
	}
}

export async function cli(args) {
	const limit = args[2] || 10;
	const selection = await directoryPrompt(workingDir, limit);

	// If the selection is a directory, cd into it
	const selectionPath = path.join(workingDir, selection);
	if (fs.lstatSync(selectionPath).isDirectory()) {
		cd(selectionPath);
	} else {
		open(selectionPath);
	}
}

/**
 * Create a prompt to select a directory.
 * The directory is selected from a list sorted by the most recent modified date.
 *
 * @param {string} cwd
 * @param {int} limit
 * @returns {Promise<string>}
 */
async function directoryPrompt(cwd, limit) {
	const cmd = `ls -1t | head -${limit}`;
	const res = await exec(cmd, { cwd });
	const choices = res.stdout.split('\n').slice(0, -1);

	if (choices.length === 0) {
		return '';
	}

	const prompt = new Selector({
		name: 're',
		message: 'Enter to navigate to dir, tab to navigate into directory',
		limit,
		choices,
	});
	const selection = await prompt.run().catch(() => {
		process.stdout.write('\x1b[1A\x1b[2K'); // Clear last line
		process.exit(0);
	});
	process.stdout.write('\x1b[1A\x1b[2K'); // Clear last line
	return selection;
}

/**
 * CD shell into a directory.
 *
 * @param {string} path
 */
function cd(path) {
	spawn(process.env.SHELL, {
		cwd: path,
		stdio: 'inherit',
	});
}

/**
 * Open a file in a code editor.
 *
 * @param {string} file The file directory
 */
function open(file) {
	const editor = process.env.EDITOR || 'open';
	const fileName = path.basename(file);
	spawn(editor, [fileName], {
		cwd: path.dirname(file),
		stdio: 'inherit',
	});
	console.log('Opened file: ' + file);
}

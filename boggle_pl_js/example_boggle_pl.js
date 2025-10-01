"use strict";

const {
	DEFAULT_POLISH_DICE,
	EXTENDED_POLISH_DICE,
	getDiceForBoardSize,
	generateBoard,
	buildTrie,
	findWords,
} = require("./boggle_pl");

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");
const zlib = require("zlib");

function nowNs() {
	return typeof process !== "undefined" && process.hrtime && process.hrtime.bigint
		? Number(process.hrtime.bigint())
		: Date.now() * 1e6;
}

function nsToMs(ns) {
	return ns / 1e6;
}

function formatTime(ns) {
	const ms = nsToMs(ns);
	if (ms >= 1000) {
		return `${(ms / 1000).toFixed(3)}s`;
	}
	return `${ms.toFixed(3)}ms`;
}


function getCachePath(dictPath) {
	const pathHash = crypto.createHash('sha256').update(dictPath).digest('hex').substring(0, 16);
	return path.join(path.dirname(dictPath), `.trie_cache_${pathHash}.bin`);
}

function getCachePathWithContentHash(dictPath, verbose = false) {
	try {
		if (verbose) console.log(`Generating hash for: ${dictPath}`);
		const t0 = nowNs();
		const content = fs.readFileSync(dictPath, 'utf8');
		const contentHash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
		const t1 = nowNs();
		if (verbose) console.log(`Hash generated in ${formatTime(t1 - t0)}: ${contentHash}`);
		return path.join(path.dirname(dictPath), `.trie_cache_${contentHash}.bin`);
	} catch (_err) {
		if (verbose) console.log(`Error generating hash: ${_err.message}`);
		return null;
	}
}

function loadTrieFromCache(dictPath, verbose = false) {
	try {
		// First try content-based cache (newer format)
		let cachePath = getCachePathWithContentHash(dictPath, verbose);
		if (!cachePath || !fs.existsSync(cachePath)) {
			// Fallback to path-based cache (legacy format)
			cachePath = getCachePath(dictPath);
			if (!fs.existsSync(cachePath)) {
				if (verbose) console.log(`Cache not found: ${cachePath}`);
				return null;
			}
			
			// Check if legacy cache is newer than dictionary
			const dictStats = fs.statSync(dictPath);
			const cacheStats = fs.statSync(cachePath);
			if (cacheStats.mtime < dictStats.mtime) {
				if (verbose) console.log(`Cache is stale, removing: ${cachePath}`);
				fs.unlinkSync(cachePath); // Remove stale cache
				return null;
			}
		}
		
		if (verbose) console.log(`Loading trie from cache: ${cachePath}`);
		const t0 = nowNs();
		const compressed = fs.readFileSync(cachePath);
		const decompressed = zlib.gunzipSync(compressed);
		const cacheData = JSON.parse(decompressed.toString('utf8'));
		const t1 = nowNs();
		if (verbose) console.log(`Cache loaded in ${formatTime(t1 - t0)}`);
		return cacheData.trie;
	} catch (_err) {
		if (verbose) console.log(`Error loading cache: ${_err.message}`);
		return null;
	}
}

function saveTrieToCache(dictPath, trie, verbose = false) {
	try {
		// Use content-based cache path
		const cachePath = getCachePathWithContentHash(dictPath, verbose);
		if (!cachePath) {
			if (verbose) console.log(`Error: Could not create cache path for ${dictPath}`);
			return;
		}
		
		const cacheData = {
			trie: trie,
			created: new Date().toISOString(),
			source: dictPath
		};
		
		if (verbose) console.log(`Creating cache file: ${cachePath}`);
		const t0 = nowNs();
		
		// Serialize to JSON and compress
		const jsonString = JSON.stringify(cacheData);
		const compressed = zlib.gzipSync(jsonString);
		
		fs.writeFileSync(cachePath, compressed);
		const t1 = nowNs();
		
		// Get dictionary file size for comparison
		const dictStats = fs.statSync(dictPath);
		const dictSizeKB = Math.round(dictStats.size / 1024);
		const cacheSizeKB = Math.round(compressed.length / 1024);
		const compressionRatio = Math.round((1 - compressed.length / dictStats.size) * 100);
		
		if (verbose) {
			console.log(`Cache created in ${formatTime(t1 - t0)}`);
			console.log(`Dictionary: ${dictSizeKB}KB, Cache: ${cacheSizeKB}KB (${compressionRatio}% smaller)`);
		}
	} catch (_err) {
		if (verbose) console.log(`Error saving cache: ${_err.message}`);
	}
}

function loadDictionaryFromFileMaybe(dictPath, verbose = false) {
	try {
		if (!dictPath) return null;
		if (!fs.existsSync(dictPath)) return null;
		if (verbose) console.log(`Loading dictionary from file: ${dictPath}`);
		const t0 = nowNs();
		const raw = fs.readFileSync(dictPath, "utf8");
		const words = raw
			.split(/\r?\n/) // split lines
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => String(line).toUpperCase())
			.filter((w) => w.length >= 2);
		const t1 = nowNs();
		if (verbose) console.log(`Loaded ${words.length} words from dictionary in ${formatTime(t1 - t0)}`);
		return words.length ? words : null;
	} catch (_err) {
		if (verbose) console.log(`Error loading dictionary: ${_err.message}`);
		return null;
	}
}

function printBoard(board) {
	console.log("Board:");
	for (const row of board) {
		console.log(" ", row.map((x) => x.padEnd(2, " ")).join(" "));
	}
}

async function waitForKey() {
	return new Promise((resolve) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.once('data', () => {
			process.stdin.setRawMode(false);
			rl.close();
			resolve();
		});
	});
}

async function countdownAndWait() {
	const totalSeconds = 3 * 60; // 3 minutes
	let remainingSeconds = totalSeconds;
	
	const interval = setInterval(() => {
		const minutes = Math.floor(remainingSeconds / 60);
		const seconds = remainingSeconds % 60;
		const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
		process.stdout.write(`\r${timeStr}`);
		remainingSeconds--;
		
		if (remainingSeconds < 0) {
			clearInterval(interval);
			process.stdout.write('\n');
		}
	}, 1000);
	
	return new Promise((resolve) => {
		process.stdin.setRawMode(true);
		process.stdin.resume();
		process.stdin.once('data', () => {
			clearInterval(interval);
			process.stdin.setRawMode(false);
			process.stdout.write('\n');
			resolve();
		});
	});
}

// ANSI color codes
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	dim: '\x1b[2m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
	white: '\x1b[37m',
};

function printWordsWithColors(words) {
	if (words.length === 0) {
		console.log("(none)");
		return;
	}

	const width = process.stdout.columns || 80;
	const maxWordLen = words.reduce((m, w) => (w.length > m ? w.length : m), 0);
	const cols = Math.max(1, Math.floor(width / (maxWordLen + 3))); // +3 for spacing
	const rows = Math.ceil(words.length / cols);

	for (let r = 0; r < rows; r++) {
		const row = [];
		for (let c = 0; c < cols; c++) {
			const idx = r * cols + c;
			if (idx >= words.length) break;
			const word = words[idx];
			const color = [colors.green, colors.blue, colors.yellow, colors.magenta, colors.cyan][c % 5];
			row.push(`${color}${word}${colors.reset}`.padEnd(maxWordLen + 9, " ")); // +9 for color codes
		}
		console.log(row.join("  ")); // Add 2 spaces between columns
	}
}

function printLinks(words) {
	if (words.length === 0) {
		console.log("(none)");
		return;
	}

	const width = process.stdout.columns || 80;
	const maxWordLen = words.reduce((m, w) => (w.length > m ? w.length : m), 0);
	const cols = Math.max(1, Math.floor(width / (maxWordLen + 3))); // +3 for spacing
	const rows = Math.ceil(words.length / cols);

	for (let r = 0; r < rows; r++) {
		const row = [];
		for (let c = 0; c < cols; c++) {
			const idx = r * cols + c;
			if (idx >= words.length) break;
			const word = words[idx];
			const color = [colors.green, colors.blue, colors.yellow, colors.magenta, colors.cyan][c % 5];
			const url = `http://sjp.pl/${word}`;
			row.push(`${color}${url}${colors.reset}`.padEnd(maxWordLen + 9, " ")); // +9 for color codes
		}
		console.log(row.join("  ")); // Add 2 spaces between columns
	}
}

function showHelp() {
	console.log(`
Polish Boggle Solver

USAGE:
  node example_boggle_pl.js [OPTIONS] [DICTIONARY_FILE]

OPTIONS:
  -h, --help          Show this help message
  -v, --verbose       Show detailed performance logs and cache operations
  -b SIZE             Set board size (e.g., -b 5x5, -b 6x6)
                      Default: 4x4

EXAMPLES:
  node example_boggle_pl.js                    # Default 4x4 board
  node example_boggle_pl.js -v                 # Verbose output
  node example_boggle_pl.js -b 5x5            # 5x5 board
  node example_boggle_pl.js -v -b 6x6         # 6x6 board with verbose output
  node example_boggle_pl.js /path/to/dict.txt  # Custom dictionary

BOARD SIZES:
  4x4  - Classic Boggle (16 dice)
  5x5  - Extended board (25 dice)
  6x6  - Large board (36 dice)
  Custom sizes supported (e.g., 3x3, 7x7)

CACHE SYSTEM:
  - First run builds compressed cache from dictionary
  - Subsequent runs load from cache (much faster)
  - Cache automatically invalidated when dictionary changes
  - Cache files: .trie_cache_[hash].bin
`);
	process.exit(0);
}

function validateArgs(args) {
	const validFlags = ['-h', '--help', '-v', '--verbose', '-b'];
	const unknownFlags = [];
	
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg.startsWith('-')) {
			// Check if it's a valid flag
			const isValidFlag = validFlags.some(flag => arg.startsWith(flag));
			// Check if it's -b with attached size (e.g., -b5x5)
			const isBoardWithSize = arg.match(/^-b\s*\d+x\d+$/);
			// Check if it's -b followed by size in next arg
			const isBoardFlag = arg === '-b' && i + 1 < args.length && args[i + 1].match(/^\d+x\d+$/);
			
			if (!isValidFlag && !isBoardWithSize && !isBoardFlag) {
				unknownFlags.push(arg);
			}
		}
	}
	
	if (unknownFlags.length > 0) {
		console.error(`Error: Unknown flag(s): ${unknownFlags.join(', ')}`);
		console.error('Use -h or --help for usage information');
		process.exit(1);
	}
}

async function main() {
	// Parse CLI arguments
	const args = process.argv.slice(2);
	
	// Check for help flag
	if (args.includes('-h') || args.includes('--help')) {
		showHelp();
	}
	
	// Validate arguments
	validateArgs(args);
	
	const verbose = args.includes('-v') || args.includes('--verbose');
	
	// Find dictionary argument (exclude -b and its value)
	let dictArg = null;
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (!arg.startsWith('-')) {
			// Check if this is a board size value (e.g., "5x5" after "-b")
			const isBoardSize = i > 0 && args[i-1] === '-b' && arg.match(/^\d+x\d+$/);
			if (!isBoardSize) {
				dictArg = arg;
				break;
			}
		}
	}
	
	// Parse board size from -b flag (e.g., -b 5x5, -b 6x6)
	let boardSize = { rows: 4, cols: 4 }; // default 4x4
	const boardArgIndex = args.findIndex(arg => arg.startsWith('-b'));
	if (boardArgIndex !== -1) {
		const boardArg = args[boardArgIndex];
		let sizeStr = '';
		
		// Check if size is attached to -b (e.g., -b5x5)
		const match = boardArg.match(/-b\s*(\d+)x(\d+)/);
		if (match) {
			sizeStr = match[1] + 'x' + match[2];
		} else {
			// Check if size is the next argument (e.g., -b 5x5)
			if (boardArgIndex + 1 < args.length) {
				const nextArg = args[boardArgIndex + 1];
				if (nextArg.match(/^\d+x\d+$/)) {
					sizeStr = nextArg;
				}
			}
		}
		
		if (sizeStr) {
			const [rows, cols] = sizeStr.split('x').map(Number);
			if (rows < 1 || cols < 1 || isNaN(rows) || isNaN(cols)) {
				console.error('Error: Board dimensions must be positive integers');
				process.exit(1);
			}
			boardSize = { rows, cols };
		} else {
			console.error(`Error: Invalid board size format. Use -b ROWSxCOLS (e.g., -b 5x5)`);
			process.exit(1);
		}
	}
	
	// Choose dice set based on board size
	const totalCells = boardSize.rows * boardSize.cols;
	const diceSet = getDiceForBoardSize(totalCells);
	
	const t0 = nowNs();
	const board = generateBoard(diceSet, boardSize);
	const t1 = nowNs();
	printBoard(board);

	// Dictionary path: dictArg or ./pl_sjp.pl.txt by default
	const defaultDictPath = path.join(__dirname, "pl_sjp.pl.txt");
	const cliDictPath = dictArg ? path.resolve(dictArg) : null;
	const dictPath = cliDictPath || defaultDictPath;

	// Try to load trie from cache first
	const t2 = nowNs();
	let trie = loadTrieFromCache(dictPath, verbose);
	let cacheHit = false;
	let dictLoadTime = 0;
	
	if (!trie) {
		// Cache miss - need to load dictionary and build trie
		const dictStart = nowNs();
		const dictionary = loadDictionaryFromFileMaybe(dictPath, verbose);
		dictLoadTime = nowNs() - dictStart;
		
		if (!dictionary) {
			console.error(`Error: Could not load dictionary from ${dictPath}`);
			process.exit(1);
		}
		
		// Build trie from dictionary and cache it
		if (verbose) console.log("Building trie from dictionary...");
		trie = buildTrie(dictionary);
		saveTrieToCache(dictPath, trie, verbose);
	} else {
		cacheHit = true;
		if (verbose) console.log("Skipped loading dictionary - using cached trie");
	}
	const t3 = nowNs();
	const foundSet = findWords(board, trie, { minLength: 3 });
	const t4 = nowNs();

	const results = Array.from(foundSet).sort((a, b) => (a.length === b.length ? (a < b ? -1 : 1) : a.length - b.length));

	await countdownAndWait();

	if (verbose) {
		console.log("\nPerformance:");
		console.log(`- Generating board: ${formatTime(t1 - t0)}`);
		if (dictLoadTime > 0) {
			console.log(`- Loading dictionary: ${formatTime(dictLoadTime)}`);
		}
		console.log(`- ${cacheHit ? 'Loading trie (cached)' : 'Building trie'}: ${formatTime(t3 - t2)}`);
		console.log(`- Finding words:    ${formatTime(t4 - t3)}`);
		console.log(`- Total time:       ${formatTime(t4 - t0)}`);
	}

	console.log("\nFound words (sorted short->long):");
	printWordsWithColors(results);
	
	console.log("\nLinks:");
	printLinks(results);
	
	process.exit(0);
}

if (require.main === module) {
	main();
}



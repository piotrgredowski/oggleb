"use strict";

// Polish Boggle (Boogle) utilities: board generator, trie, and solver.
// - Supports multi-character faces like "CH", "CZ", "RZ", "SZ" similar to English "Qu".
// - Board is represented as a 4x4 matrix of strings (each string is one cube face value).

/**
 * A lightweight random helper using crypto if available, else Math.random.
 */
function randomInt(maxExclusive) {
	if (maxExclusive <= 0) return 0;
	if (typeof crypto !== "undefined" && crypto.getRandomValues) {
		const array = new Uint32Array(1);
		crypto.getRandomValues(array);
		return array[0] % maxExclusive;
	}
	return Math.floor(Math.random() * maxExclusive);
}

/**
 * Default Polish-oriented dice set (16 dice, each with 6 faces).
 * NOTE: This is a reasonable starting point, not an official distribution.
 * Includes common Polish bigrams as single faces and diacritics.
 */
const DEFAULT_POLISH_DICE = [
	["A", "A", "Ą", "E", "I", "O"],
	["N", "R", "S", "T", "L", "K"],
	["E", "E", "A", "O", "I", "Y"],
	["M", "N", "R", "D", "T", "P"],
	["S", "Z", "SZ", "CZ", "DZ", "RZ"],
	["C", "H", "CH", "K", "L", "W"],
	["P", "B", "D", "G", "M", "T"],
	["Ł", "Ś", "Ź", "Ż", "Ć", "Ń"],
	["U", "Ó", "Y", "E", "A", "I"],
	["O", "O", "A", "E", "I", "U"],
	["J", "R", "L", "N", "S", "Z"],
	["K", "G", "H", "W", "F", "R"],
	["Z", "Z", "S", "R", "N", "L"],
	["D", "DŹ", "DŻ", "DZ", "R", "T"],
	["C", "CZ", "SZ", "RZ", "CH", "Ż"],
	["E", "A", "I", "O", "U", "Y"],
];

/**
 * Extended dice set for larger boards (up to 36 dice for 6x6).
 * Additional dice with more Polish letters and combinations.
 */
const EXTENDED_POLISH_DICE = [
	// Original 16 dice
	...DEFAULT_POLISH_DICE,
	// Additional dice for 5x5 and 6x6 (20 more)
	["A", "Ą", "E", "Ę", "I", "O"],
	["Ó", "U", "Y", "A", "E", "I"],
	["B", "C", "D", "F", "G", "H"],
	["J", "K", "L", "M", "N", "P"],
	["R", "S", "T", "W", "Z", "Ż"],
	["CH", "CZ", "DZ", "DŻ", "DŹ", "RZ"],
	["SZ", "Ś", "Ź", "Ć", "Ń", "Ł"],
	["A", "E", "I", "O", "U", "Y"],
	["B", "C", "D", "F", "G", "H"],
	["J", "K", "L", "M", "N", "P"],
	["R", "S", "T", "W", "Z", "Ż"],
	["A", "Ą", "E", "Ę", "I", "O"],
	["Ó", "U", "Y", "A", "E", "I"],
	["CH", "CZ", "DZ", "DŻ", "DŹ", "RZ"],
	["SZ", "Ś", "Ź", "Ć", "Ń", "Ł"],
	["B", "C", "D", "F", "G", "H"],
	["J", "K", "L", "M", "N", "P"],
	["R", "S", "T", "W", "Z", "Ż"],
	["A", "E", "I", "O", "U", "Y"],
	["B", "C", "D", "F", "G", "H"]
];

/**
 * Get the appropriate dice set for a given board size.
 * @param {number} totalCells - Total number of cells on the board
 * @returns {string[][]} Array of dice with the correct count
 */
function getDiceForBoardSize(totalCells) {
	if (totalCells <= 16) {
		return DEFAULT_POLISH_DICE;
	} else if (totalCells <= 36) {
		return EXTENDED_POLISH_DICE.slice(0, totalCells);
	} else {
		// For very large boards, repeat the extended dice set
		const dice = [];
		while (dice.length < totalCells) {
			dice.push(...EXTENDED_POLISH_DICE);
		}
		return dice.slice(0, totalCells);
	}
}

/**
 * Shuffle an array in-place using Fisher-Yates.
 */
function shuffleInPlace(array) {
	for (let i = array.length - 1; i > 0; i -= 1) {
		const j = randomInt(i + 1);
		const tmp = array[i];
		array[i] = array[j];
		array[j] = tmp;
	}
	return array;
}

/**
 * Generate a Boggle board by shuffling dice and rolling each die.
 * @param {string[][]} dice - Array of dice, each die has 6 string faces
 * @param {{rows: number, cols: number}} size - Board dimensions
 * @returns {string[][]} matrix of strings
 */
function generateBoard(dice = DEFAULT_POLISH_DICE, size = { rows: 4, cols: 4 }) {
	const totalCells = size.rows * size.cols;
	if (!Array.isArray(dice) || dice.length !== totalCells) {
		throw new Error(`dice must be an array of ${totalCells} dice (each with 6 faces)`);
	}
	const diceCopy = dice.map((faces) => {
		if (!Array.isArray(faces) || faces.length !== 6) {
			throw new Error("each die must have exactly 6 faces");
		}
		return faces.slice();
	});
	shuffleInPlace(diceCopy);

	const faces = diceCopy.map((facesOfDie) => facesOfDie[randomInt(6)]);
	const board = [];
	for (let r = 0; r < size.rows; r += 1) {
		board.push(faces.slice(r * size.cols, r * size.cols + size.cols));
	}
	return board;
}

/**
 * Build a trie from a list of words. Words are uppercased and trimmed.
 * @param {string[]} words
 * @returns {object} root trie node
 */
function buildTrie(words) {
	const root = { children: Object.create(null), isWord: false };
	for (const raw of words) {
		if (!raw) continue;
		const word = String(raw).trim().toUpperCase();
		if (word.length === 0) continue;
		let node = root;
		for (let i = 0; i < word.length; i += 1) {
			const ch = word[i];
			if (!node.children[ch]) node.children[ch] = { children: Object.create(null), isWord: false };
			node = node.children[ch];
		}
		node.isWord = true;
	}
	return root;
}

/**
 * Try to advance in the trie by a string segment (which may be multi-char, e.g., "CZ").
 * Returns the node after consuming the segment, or null if not a valid prefix.
 */
function advanceTrieBySegment(node, segment) {
	let current = node;
	for (let i = 0; i < segment.length; i += 1) {
		const ch = segment[i].toUpperCase();
		current = current && current.children[ch];
		if (!current) return null;
	}
	return current;
}

/**
 * Find all valid words on the given board using the provided trie.
 * @param {string[][]} board matrix of strings (faces)
 * @param {object} trieRoot root of trie built via buildTrie
 * @param {{ minLength?: number }} options
 * @returns {Set<string>} set of found uppercase words
 */
function findWords(board, trieRoot, options) {
	if (!board || board.length === 0 || board.some((row) => !Array.isArray(row) || row.length === 0)) {
		throw new Error("board must be a non-empty matrix");
	}
	const rows = board.length;
	const cols = board[0].length;
	const minLength = options && options.minLength ? options.minLength : 3;
	const found = new Set();
	const visited = new Array(rows).fill(null).map(() => new Array(cols).fill(false));

	function dfs(r, c, node, currentWord) {
		if (r < 0 || r >= rows || c < 0 || c >= cols) return;
		if (visited[r][c]) return;

		const face = String(board[r][c]).toUpperCase();
		const nextNode = advanceTrieBySegment(node, face);
		if (!nextNode) return;

		const nextWord = currentWord + face;
		if (nextNode.isWord && nextWord.length >= minLength) {
			found.add(nextWord);
		}

		visited[r][c] = true;
		for (let dr = -1; dr <= 1; dr += 1) {
			for (let dc = -1; dc <= 1; dc += 1) {
				if (dr === 0 && dc === 0) continue;
				dfs(r + dr, c + dc, nextNode, nextWord);
			}
		}
		visited[r][c] = false;
	}

	for (let r = 0; r < rows; r += 1) {
		for (let c = 0; c < cols; c += 1) {
			dfs(r, c, trieRoot, "");
		}
	}

	return found;
}

/**
 * Solve a board given a dictionary array. Convenience wrapper around buildTrie/findWords.
 * @param {string[][]} board
 * @param {string[]} dictionary list of lowercase/uppercase words
 * @param {{ minLength?: number }} options
 * @returns {string[]} sorted list of unique uppercase words
 */
function solveBoard(board, dictionary, options) {
	const trie = buildTrie(dictionary || []);
	const set = findWords(board, trie, options || {});
	return Array.from(set).sort((a, b) => (a.length === b.length ? (a < b ? -1 : 1) : a.length - b.length));
}

module.exports = {
	DEFAULT_POLISH_DICE,
	EXTENDED_POLISH_DICE,
	getDiceForBoardSize,
	generateBoard,
	buildTrie,
	findWords,
	solveBoard,
};



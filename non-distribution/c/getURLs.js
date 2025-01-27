#!/usr/bin/env node

/*
Extract all URLs from a web page.
Usage: ./getURLs.js <base_url>
*/

// JSDOM is extremely slow on startup, so I added an additional "fast" mode that
// uses a simple regex to parse links from HTML.
const MODE = 'fast';

const readline = require('readline');
const {JSDOM} = MODE === 'fast' ? {JSDOM: null} : require('jsdom');
const {URL} = require('url');

// 1. Read the base URL from the command-line argument using `process.argv`.
if (process.argv.length < 3) {
  console.error('Expected base URL');
  process.exit(1);
}
let baseURL = new URL(process.argv[2]).toString();

if (baseURL.endsWith('index.html')) {
  baseURL = baseURL.slice(0, baseURL.length - 'index.html'.length);
} else if (!baseURL.endsWith('/')) {
  baseURL += '/';
}

const rl = readline.createInterface({
  input: process.stdin,
});
let content = '';

rl.on('line', (line) => {
  // 2. Read HTML input from standard input (stdin) line by line using the `readline` module.
  content += line + '\n';
});

rl.on('close', () => {
  // 3. Parse HTML using jsdom

  // 4. Find all URLs:
  //  - select all anchor (`<a>`) elements) with an `href` attribute using `querySelectorAll`.
  //  - extract the value of the `href` attribute for each anchor element.
  // 5. Print each absolute URL to the console, one per line.
  if (MODE === 'fast') {
    findLinksFast(content);
  } else {
    findLinksSlow(content);
  }
});

function findLinksFast(content) {
  // Extract URLs from HTML using regex
  const URL_REGEX = /<a\s+(?:[^>]*?\s+)?href\s*=\s*(['"])(.*?)\1/gi;
  const matches = content.matchAll(URL_REGEX);
  for (const match of matches) {
    const url = new URL(match[2], baseURL).toString();
    console.log(url);
  }
}

function findLinksSlow(content) {
  // Extract URLs from HTML using jsdom
  const document = new JSDOM(content);
  const links = document.window.document.querySelectorAll('a');
  for (const link of links) {
    const url = new URL(link.href, baseURL).toString();
    console.log(url);
  }
}

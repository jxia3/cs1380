#!/usr/bin/env node

/*
Convert input to a stream of non-stopword terms
Usage: ./process.sh < input > output
*/

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const STOPWORD_FILE = path.join(__dirname, '../d/stopwords.txt');

const rl = readline.createInterface({
  input: process.stdin,
});
let content = '';

rl.on('line', (line) => {
  content += line + '\n';
});

rl.on('close', () => {
  content = content.replaceAll(/[^a-zA-Z\n]/g, '\n');
  content = content.replaceAll(/\s+/g, '\n').trim();
  content = content.toLowerCase();
  fs.readFile(STOPWORD_FILE, 'utf8', (error, data) => {
    if (error) {
      console.error('Error reading file:', error);
      process.exit(1);
    }
    removeStopwords(data, content);
  });
});

function removeStopwords(data, content) {
  const stopwords = data.trim().split('\n');
  const words = content.split('\n').filter((w) => !stopwords.includes(w));
  for (const word of words) {
    console.log(word);
  }
}

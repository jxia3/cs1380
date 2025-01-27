#!/usr/bin/env node

const fs = require('fs');
const natural = require('natural');
const path = require('path');

// Parse command line arguments
if (process.argv.length < 4) {
  console.error('expected content file and page URL');
  process.exit(1);
}
const contentFile = process.argv[2];
const pageURL = process.argv[3];

console.log(contentFile, pageURL)
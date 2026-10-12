// This script runs on the trusted default branch ONLY (workflow_run).
// PR artifacts are parsed as JSON data; no code from PR checkout is executed here.
import { readFile } from 'node:fs/promises';
import { publishPrComment } from '../dist/github/pr.js';
const repo = process.env.GITHUB_REPOSITORY;
const pr = Number(process.env.PR_NUMBER);
const sha = process.env.RUN_HEAD_SHA;
const token = process.env.GITHUB_TOKEN;
if (!repo || !pr || !sha || !token) throw Error('Missing workflow context');
const file = 'pr-artifact/report.json';
const text = await readFile(file, 'utf8');
if (Buffer.byteLength(text) > 2_000_000) throw Error('Report artifact exceeds 2 MB');
const report = JSON.parse(text);
const result = await publishPrComment({repo, pr, token, expectedSha: sha, report});
console.log(`GitHub comment ${result.action}: ${result.url ?? ''}`);

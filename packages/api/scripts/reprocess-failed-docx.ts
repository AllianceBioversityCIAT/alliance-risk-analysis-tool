#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type ReprocessDocxAction = 'requeued' | 'skipped' | 'dry-run-matched';

interface ReprocessDocxResultRow {
  id: string;
  fileName: string;
  action: ReprocessDocxAction;
}

interface WorkerResponse {
  success: boolean;
  error?: string;
  matched?: number;
  requeued?: number;
  results?: ReprocessDocxResultRow[];
}

interface ScriptOptions {
  dryRun: boolean;
  assessmentId?: string;
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: 'utf-8' }).trim();
}

function parseArgs(argv: string[]): ScriptOptions {
  const assessmentArg = argv.find((arg) => arg.startsWith('--assessment-id='));
  const assessmentId = assessmentArg?.split('=')[1];

  return {
    dryRun: argv.includes('--dry-run'),
    assessmentId: assessmentId && assessmentId.length > 0 ? assessmentId : undefined,
  };
}

function getWorkerAdminToken(): string {
  const secret = run('aws', [
    'secretsmanager',
    'get-secret-value',
    '--secret-id',
    'alliance-risk/worker-admin-token',
    '--query',
    'SecretString',
    '--output',
    'text',
  ]);

  return JSON.parse(secret).token;
}

function invokeWorker(payload: Record<string, unknown>): WorkerResponse {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'reprocess-failed-docx-'));
  const payloadPath = path.join(tempDir, 'payload.json');
  const outputPath = path.join(tempDir, 'result.json');

  try {
    writeFileSync(payloadPath, JSON.stringify(payload), 'utf-8');

    run('aws', [
      'lambda',
      'invoke',
      '--function-name',
      'alliance-risk-worker',
      '--payload',
      `fileb://${payloadPath}`,
      '--cli-binary-format',
      'raw-in-base64-out',
      outputPath,
    ]);

    return JSON.parse(readFileSync(outputPath, 'utf-8')) as WorkerResponse;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function renderResultsTable(results: ReprocessDocxResultRow[]): void {
  if (results.length === 0) {
    console.log('No matching DOCX documents found.');
    return;
  }

  console.table(
    results.map((result) => ({
      id: result.id,
      fileName: result.fileName,
      action: result.action,
    })),
  );
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const token = getWorkerAdminToken();
  const result = invokeWorker({
    action: 'reprocess-failed-docx',
    authToken: token,
    dryRun: options.dryRun,
    assessmentId: options.assessmentId,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to reprocess DOCX documents');
  }

  renderResultsTable(result.results ?? []);
  console.log(
    JSON.stringify(
      {
        matched: result.matched ?? 0,
        requeued: result.requeued ?? 0,
        dryRun: options.dryRun,
        assessmentId: options.assessmentId ?? null,
      },
      null,
      2,
    ),
  );
}

main();

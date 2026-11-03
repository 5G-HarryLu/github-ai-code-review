import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { buildCallGraph, Repository } from '../src/callgraph.ts';
import type { ReviewFile } from '../src/context.ts';

function repoWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'callgraph-'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init');
  return root;
}

const changed = (filename: string, added: number[]): ReviewFile => ({
  filename,
  status: 'modified',
  additions: added.length,
  deletions: 0,
  annotated: '',
  lines: new Map(),
  added: new Set(added),
});

test('go: finds the changed function, its callers and the functions its new lines call', async () => {
  const root = repoWith({
    'wallet/wallet.go': [
      'package wallet',
      '',
      'func (w *Wallet) Debit(amount int64) error {',
      '\tif w.Balance < amount {',
      '\t\treturn ErrNoMoney',
      '\t}',
      '\tw.Balance -= amount',
      '\treturn w.save()',
      '}',
      '',
      'func (w *Wallet) save() error {',
      '\treturn nil',
      '}',
    ].join('\n'),
    'bet/service.go': ['package bet', '', 'func PlaceBet(w *wallet.Wallet) error {', '\t// Debit( in a comment is not a call', '\treturn w.Debit(10)', '}'].join('\n'),
    'bet/service_test.go': ['package bet', '', 'func TestX(t *testing.T) {', '\tw.Debit(1)', '}'].join('\n'),
  });
  const repo = new Repository(root);
  await repo.assertHead(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim());

  const [g, ...rest] = await buildCallGraph(repo, [changed('wallet/wallet.go', [7, 8])]);
  assert.equal(rest.length, 0);
  assert.deepEqual(g.fn, { name: 'Debit', file: 'wallet/wallet.go', line: 3 });
  assert.deepEqual(
    g.callers.map(c => [c.caller.name, c.file, c.line]),
    [['PlaceBet', 'bet/service.go', 5]],
  );
  assert.deepEqual(
    g.callees.map(c => [c.definition.name, c.definition.line]),
    [['save', 11]],
  );
});

test('c#: skips interface declarations and lists each calling method once', async () => {
  const root = repoWith({
    'Engine/IWallet.cs': ['public interface IWallet', '{', '    long Debit(long amount);', '}'].join('\n'),
    'Engine/Wallet.cs': [
      'public class Wallet : IWallet',
      '{',
      '    private (long Left, bool Ok)? Check(long amount) => null;',
      '',
      '    public long Debit(long amount)',
      '    {',
      '        var r = Check(amount);',
      '        return amount;',
      '    }',
      '}',
    ].join('\n'),
    'Engine/Spin.cs': [
      'public class Spin',
      '{',
      '    public async Task<long> RunAsync(IWallet w)',
      '    {',
      '        w.Debit(1);',
      '        return w.Debit(2);',
      '    }',
      '}',
    ].join('\n'),
  });
  const [g] = await buildCallGraph(new Repository(root), [changed('Engine/Wallet.cs', [7])]);
  assert.equal(g.fn.name, 'Debit');
  assert.deepEqual(
    g.callers.map(c => [c.caller.name, c.line]),
    [['RunAsync', 5]],
  );
  assert.deepEqual(
    g.callees.map(c => c.definition.name),
    ['Check'],
  );
});

test('refuses to run on a checkout that is not the PR head', async () => {
  const root = repoWith({ 'a.go': 'package a' });
  await assert.rejects(new Repository(root).assertHead('0'.repeat(40)), /actions\/checkout/);
});

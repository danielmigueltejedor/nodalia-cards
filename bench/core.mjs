import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const REPOSITORY = 'danielmigueltejedor/nodalia-cards';
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function checkedVersion(version) {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(version)) throw new Error(`Invalid release version ${version}`);
  return version;
}
const releaseAssetUrl = version => `https://github.com/${REPOSITORY}/releases/download/v${checkedVersion(version)}/nodalia-cards.js`;
export function parseArgs(args, env = {}) {
  const options = { versions: [], quick: env.NODALIA_BENCH_QUICK === '1', browsers: null, out: 'bench/results', publishNotes: false, skipFirefoxOnMac: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--') continue;
    if (arg === '--quick') { options.quick = true; continue; }
    if (arg === '--skip-firefox-on-mac') { options.skipFirefoxOnMac = true; continue; }
    if (arg === '--browsers' || arg === '--out') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${arg}`);
      options[arg.slice(2)] = arg === '--browsers' ? args[++i].split(',') : args[++i];
      continue;
    }
    if (arg === '--publish-notes') { options.publishNotes = true; continue; }
    if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}`);
    const version = arg.replace(/^v/, '');
    if (!/^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/.test(version)) throw new Error(`Invalid release version ${arg}`);
    if (options.versions.includes(version)) throw new Error(`Duplicate release ${version}`);
    options.versions.push(version);
  }
  if (options.versions.length < 2) throw new Error('Provide at least two published releases');
  if(options.browsers&&(new Set(options.browsers).size!==options.browsers.length||options.browsers.some(name=>!['chromium','firefox','webkit','webkit-iphone'].includes(name))))throw new Error('Invalid or duplicate browser projects');
  if (options.publishNotes && options.quick) throw new Error('Quick runs cannot publish release notes');
  return options;
}
export function referencePolicy(options, platform) {
  const all = ['chromium','firefox','webkit','webkit-iphone'];
  if (options.skipFirefoxOnMac) {
    if (platform !== 'darwin' || options.quick || options.browsers ||
        !options.versions.some(v=>/^3\.0\.0-rc\.[1-9]\d*$/.test(v)) || options.versions.includes('3.0.0'))
      throw new Error('Firefox exception requires an official macOS RC run; stable, quick and custom browser selection are excluded');
    return { browsers: all.filter(name=>name!=='firefox'), referenceException: 'macos-firefox-rc' };
  }
  if (!options.quick && options.browsers && options.browsers.length !== 4)
    throw new Error('Official runs require all four browser projects');
  return { browsers: options.browsers || all, referenceException: null };
}
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
}
export function statistics(values) {
  if (!values.length) return { samples: 0, min: null, max: null, mean: null, median: null, p95: null };
  if (!values.every(Number.isFinite)) throw new Error('Non-finite metric sample');
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return { samples: values.length, min: sorted[0], max: sorted.at(-1), mean: values.reduce((a,b)=>a+b,0)/values.length,
    median: sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2, p95: percentile(values, .95) };
}
export const hasSkips = result => Array.isArray(result.skipped) && result.skipped.length > 0;
export function sampleOrder(versions, iteration) { return iteration % 2 ? [...versions].reverse() : [...versions]; }
export function summarize(samples) {
  const groups = new Map();
  for (const sample of samples) {
    if (hasSkips(sample) || sample.error || sample.errors?.length) continue;
    const key = JSON.stringify([sample.browser, sample.version, sample.scenario, sample.scope]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(sample);
  }
  return [...groups.values()].map(group => {
    const first = group[0];
    const metrics = [...new Set(group.flatMap(s=>Object.keys(s.metrics)))];
    return { browser: first.browser, version: first.version, scenario: first.scenario, scope: first.scope,
      metrics: Object.fromEntries(metrics.map(key=>[key, statistics(group.map(s=>s.metrics[key]).filter(Number.isFinite))])) };
  });
}
export function verifyAsset(release, bytes, version) {
  checkedVersion(version);
  if (release.tag_name !== `v${version}` || release.draft || !release.published_at) throw new Error(`Release ${version} is not published at its exact tag`);
  const asset = release.assets?.find(a=>a.name === 'nodalia-cards.js');
  if (!asset) throw new Error(`Release ${version} has no nodalia-cards.js asset`);
  const hash = sha256(bytes);
  if (asset.size !== bytes.length) throw new Error(`Asset size mismatch for ${version}`);
  if (asset.digest && asset.digest !== `sha256:${hash}`) throw new Error(`Asset digest mismatch for ${version}`);
  if (asset.browser_download_url !== releaseAssetUrl(version)) throw new Error('Untrusted release asset URL');
  return { version, tag: release.tag_name, releaseId: release.id, assetId: asset.id, assetUrl: asset.browser_download_url,
    publishedAt: release.published_at, rawBytes: bytes.length, gzipBytes: zlib.gzipSync(bytes).length,
    brotliBytes: zlib.brotliCompressSync(bytes).length, sha256: hash, githubDigest: asset.digest || null,
    provenance: 'github-release-asset' };
}
export async function loadAsset(version, directory, fetcher = fetch) {
  checkedVersion(version);
  const location = path.join(directory, version), bundlePath = path.join(location, 'nodalia-cards.js');
  const manifestPath = path.join(location, 'github-release.json');
  const headers = { Accept:'application/vnd.github+json', 'User-Agent':'nodalia-release-benchmark' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  async function download(url, binary = false) {
    const response = await fetcher(url, { headers: url.startsWith('https://api.github.com/') ? headers : {}, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Release download HTTP ${response.status}: ${url}`);
    return binary ? Buffer.from(await response.arrayBuffer()) : await response.json();
  }
  let release;
  try { release = JSON.parse(await fs.readFile(manifestPath,'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; release = await download(`https://api.github.com/repos/${REPOSITORY}/releases/tags/v${version}`); }
  if (release.tag_name !== `v${version}` || release.draft || !release.published_at) throw new Error(`Release ${version} is not published`);
  const remote = release.assets?.find(a=>a.name === 'nodalia-cards.js');
  if (!remote) throw new Error(`Release ${version} has no nodalia-cards.js asset`);
  if (remote.browser_download_url !== releaseAssetUrl(version)) throw new Error('Untrusted release asset URL');
  let bytes;
  try { bytes = await fs.readFile(bundlePath); }
  catch (error) { if (error.code !== 'ENOENT') throw error; bytes = await download(releaseAssetUrl(version),true); }
  const asset = verifyAsset(release, bytes, version);
  // Persist only after validation: an HTML/error response cannot poison the cache.
  await fs.mkdir(location,{recursive:true});
  await fs.writeFile(bundlePath,bytes); await fs.writeFile(manifestPath,JSON.stringify(release,null,2)+'\n');
  return asset;
}
export function validateResult(result) {
  const fail = message => { throw new Error(`Benchmark schema v1: ${message}`); };
  if (result.schemaVersion !== 1) fail('unsupported schemaVersion');
  for (const field of ['metadata','config','browsers','summary','samples','skips','errors','assets','versions','bundle']) if (result[field] === undefined) fail(`missing ${field}`);
  for (const key of ['versions','assets','bundle','browsers','summary','samples','skips','errors']) if (!Array.isArray(result[key])) fail(`${key} must be an array`);
  if (!['quick','official'].includes(result.metadata.mode) || !result.metadata.harnessCommit || !result.metadata.timestamp) fail('missing run provenance');
  for(const field of ['platform','osRelease','osVersion','architecture','cpu','node','pnpm','playwright'])if(typeof result.metadata[field]!=='string'||!result.metadata[field])fail(`missing metadata ${field}`);
  if(!/^[a-f0-9]{64}$/.test(result.metadata.harnessFilesSha256)||typeof result.metadata.harnessDirty!=='boolean'||typeof result.metadata.workingTreeDirty!=='boolean')fail('invalid harness provenance');
  if(!Number.isSafeInteger(result.metadata.ramBytes)||result.metadata.ramBytes<=0||!Number.isSafeInteger(result.metadata.logicalCpus)||result.metadata.logicalCpus<1)fail('invalid hardware metadata');
  for(const field of ['iterations','warmups','assignments','quietMs','settleTimeoutMs'])if(!Number.isSafeInteger(result.config[field])||result.config[field]<(field==='warmups'?0:1))fail(`invalid config ${field}`);
  if (result.versions.length < 2 || new Set(result.versions).size !== result.versions.length) fail('need distinct versions');
  if(new Set(result.browsers.map(browser=>browser.name)).size!==result.browsers.length)fail('duplicate browsers');
  for(const browser of result.browsers){if(!['chromium','firefox','webkit','webkit-iphone'].includes(browser.name)||!['available','unavailable'].includes(browser.status))fail('invalid browser availability');if(browser.status==='available'&&(!browser.version||!Number.isFinite(browser.devicePixelRatio)||!Number.isFinite(browser.viewport?.width)||!Number.isFinite(browser.viewport?.height)))fail('missing browser version/viewport/DPR');}
  if(result.assets.length!==result.versions.length||result.bundle.length!==result.versions.length)fail('asset/bundle cardinality');
  for (const version of result.versions) {
    const asset = result.assets.find(a=>a.version === version);
    if (!asset || !/^[a-f0-9]{64}$/.test(asset.sha256) || asset.provenance !== 'github-release-asset' || asset.tag !== `v${version}`) fail(`asset provenance for ${version}`);
    if (![asset.rawBytes,asset.gzipBytes].every(n=>Number.isSafeInteger(n)&&n>0)) fail('invalid asset bytes');
    const bundle=result.bundle.find(row=>row.version===version);if(!bundle||['rawBytes','gzipBytes','sha256'].some(key=>bundle[key]!==asset[key]))fail('bundle projection mismatch');
  }
  const identities=new Set();
  for (const sample of result.samples) {
    if (!result.versions.includes(sample.version) || !sample.browser || !sample.scenario || !['common','3.0-only'].includes(sample.scope)) fail('invalid sample identity');
    if (!sample.metrics || !Array.isArray(sample.skipped)) fail('missing sample metrics/skipped');
    if(!Number.isSafeInteger(sample.iteration)||sample.iteration<0)fail('invalid measured iteration');
    if(sample.iteration>=result.config.iterations)fail('iteration exceeds configured rounds');
    if(!result.browsers.some(browser=>browser.name===sample.browser))fail('unlisted sample browser');
    const identity=JSON.stringify([sample.browser,sample.version,sample.scenario,sample.scope,sample.iteration]);if(identities.has(identity))fail('duplicate raw sample');identities.add(identity);
    for (const value of Object.values(sample.metrics)) if (value !== null && !Number.isFinite(value)) fail('non-finite metric');
    if(!hasSkips(sample)&&['workMs','settleMs','totalMs'].some(key=>!Number.isFinite(sample.metrics[key])||sample.metrics[key]<0))fail('missing successful timing');
    if (sample.metrics.totalMs !== null && sample.metrics.workMs !== null && sample.metrics.settleMs !== null && Math.abs(sample.metrics.totalMs - sample.metrics.workMs - sample.metrics.settleMs) > .01) fail('work/settle/total inconsistency');
  }
  const expected = summarize(result.samples);
  if (JSON.stringify(expected) !== JSON.stringify(result.summary)) fail('summary does not match raw samples');
  return result;
}
export const csvEscape = value => /[",\n\r]/.test(String(value)) ? `"${String(value).replaceAll('"','""')}"` : String(value);
export function csv(result) {
  const rows = [['browser','version','scenario','scope','iteration','metric','value']];
  for (const sample of result.samples) for (const [metric,value] of Object.entries(sample.metrics)) rows.push([sample.browser,sample.version,sample.scenario,sample.scope,sample.iteration,metric,value === null ? 'unavailable' : value]);
  return rows.map(row=>row.map(csvEscape).join(',')).join('\n')+'\n';
}
const fmt = value => value === null || value === undefined ? 'unavailable' : Number(value).toFixed(2);
const escapeMd = value => String(value).replaceAll('|','\\|').replaceAll('\n',' ');
export function delta(before,after) { return before ? `${((after-before)/before*100).toFixed(1)}%` : after === 0 ? '0%' : 'n/a (zero baseline)'; }
export function markdown(result) {
  const lines = [`# Release performance: ${result.versions.join(' vs ')}`, '', `Mode: **${result.metadata.mode}**. Harness: \`${result.metadata.harnessCommit}\`.`,
    '', `System: ${result.metadata.platform} ${result.metadata.architecture}; ${result.metadata.cpu}; ${result.metadata.ramBytes} bytes RAM.`,
    ...(result.metadata.referenceException ? ['', 'RC reference exception: Firefox is unavailable on this Mac and excluded by explicit release-owner authorization. No Firefox timings or four-engine performance claim are made.'] : []),
    '', 'workMs is synchronous dispatch CPU wall time; settleMs is the remaining elapsed time until quiet and pending fixture work settle. totalMs = workMs + settleMs. Chromium ScriptDuration/LayoutDuration are separate CPU measurements. Timings include equal instrumentation overhead; counts do not imply cost.',
    '', '## Published assets', '', '| Version | SHA256 | Raw bytes | Gzip bytes |', '|---|---|---:|---:|'];
  for (const asset of result.assets) lines.push(`| ${asset.version} | ${asset.sha256} | ${asset.rawBytes} | ${asset.gzipBytes} |`);
  for (const browser of result.browsers) {
    lines.push('', `## ${browser.name}: unrelated HA updates`, '', '| Card | '+result.versions.map(v=>`${v} mutations`).join(' | ')+' | mutation change | work change | total change |', '|---|'+result.versions.map(()=>'---:').join('|')+'|---|---|---|');
    for(const scenario of [...new Set(result.summary.filter(row=>row.browser===browser.name&&row.scope==='common'&&row.scenario.startsWith('unrelated/')).map(row=>row.scenario))]) {
      const rows=result.versions.map(version=>result.summary.find(row=>row.browser===browser.name&&row.version===version&&row.scenario===scenario));
      const changes=metric=>rows.slice(1).map(row=>row?.metrics[metric]?.samples&&rows[0]?.metrics[metric]?.samples?delta(rows[0].metrics[metric].median,row.metrics[metric].median):'unavailable').join('; ');
      lines.push(`| ${scenario.slice(10)} | ${rows.map(row=>fmt(row?.metrics.mutations?.median)).join(' | ')} | ${changes('mutations')} | ${changes('workMs')} | ${changes('totalMs')} |`);
    }
    lines.push('', `## ${browser.name} (${browser.version || 'unavailable'})`, '', '| Scenario | Metric | '+result.versions.join(' | ')+' | Change vs first |', '|---|---|'+result.versions.map(()=>'---:').join('|')+'|---|');
    const keys = [...new Set(result.summary.filter(row=>row.browser===browser.name && row.scope==='common').map(row=>row.scenario))];
    for (const scenario of keys) for (const metric of ['workMs','settleMs','totalMs','mutations','childList','attributes','characterData','scriptCpuMs','layoutCpuMs']) {
      const values = result.versions.map(version=>result.summary.find(row=>row.browser===browser.name && row.version===version && row.scenario===scenario)?.metrics[metric]);
      const cells = values.map(stat=>stat?.samples ? `${fmt(stat.median)} (p95 ${fmt(stat.p95)}, n=${stat.samples})` : 'unavailable');
      const changes = values.slice(1).map(stat=>stat?.samples && values[0]?.samples ? delta(values[0].median,stat.median) : 'unavailable');
      lines.push(`| ${escapeMd(scenario)} | ${metric} | ${cells.join(' | ')} | ${changes.join('; ')} |`);
    }
    const extra = result.summary.filter(row=>row.browser===browser.name&&row.scope==='3.0-only');
    if (extra.length) { lines.push('', '### 3.0-only performance (excluded from generation-2 deltas)', '', '| Scenario | Version | work median/p95 | total median/p95 |', '|---|---|---:|---:|'); for(const row of extra) lines.push(`| ${escapeMd(row.scenario)} | ${row.version} | ${fmt(row.metrics.workMs?.median)}/${fmt(row.metrics.workMs?.p95)} | ${fmt(row.metrics.totalMs?.median)}/${fmt(row.metrics.totalMs?.p95)} |`); }
    lines.push('', '### Profile detail and retention (median / p95)', '', '| Scenario | Version | Scope | Metric | Median | p95 | n |','|---|---|---|---|---:|---:|---:|');
    const detailMetrics=['removedNodes','renderCalls','renderBoundaryMs','renderedFrames','preloadImages','artworkRequests','artworkSamples','artworkSamplingMs','paletteWorkMs','historyGenerationMs','historyInputPoints','historySamplesObserved','historyIngestionMs','numericProcessingMs','svgRenderingMs','gestureFullRenders','gestureOverlayBuilds','feedbackUpdates','mapFeedbackUpdates','markerIdentity','mapImageIdentity','mapScaleBefore','mapScaleAfter','catalogScans','engineCommands','engineV3Commands','sectionsOverflowPx','sectionsCardHeight','sectionsCellHeight','usedBefore','usedAfter','usedDelta','totalHeapBytes','residualNodes','residualBrowserNodes'];
    for(const row of result.summary.filter(row=>row.browser===browser.name&&!/^(?:unrelated|relevant|mount|warm-remount)\//.test(row.scenario)))for(const metric of detailMetrics){const stat=row.metrics[metric];if(!stat)continue;lines.push(`| ${escapeMd(row.scenario)} | ${row.version} | ${row.scope} | ${metric} | ${fmt(stat.median)} | ${fmt(stat.p95)} | ${stat.samples} |`);}
  }
  lines.push('', '## Skips and errors', '', '```json',JSON.stringify({skips:result.skips,errors:result.errors},null,2),'```','',
    'Quick and official results must not be compared. Playwright iPhone WebKit is emulation, not a physical Safari device. Empty skipped arrays are successful samples. Multiple controlled-GC samples and trends are needed to diagnose retention; a single heap delta is not evidence of a leak. No browser averages or global speed claim are produced.');
  return lines.join('\n')+'\n';
}

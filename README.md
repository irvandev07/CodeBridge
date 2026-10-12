# CodeBridge Pro Beta v0.3

**Intent-to-Code Verification:** CLI open-source TypeScript/Node.js untuk menghubungkan acceptance criteria dengan test yang eksplisit, menganalisis perubahan Git, dan mengumpulkan evidence menjadi laporan yang dapat diaudit. **Bekerja tanpa AI**. Ini adalah developer-tool beta, belum pengganti code review atau security scanner profesional.

## Yang baru di v0.3 — Smart Evidence Engine

- **Discovery Node TAP**: membaca hasil test kasus individual dari check yang menghasilkan TAP; tidak perlu AI atau parser proprietary.
- **Exact test linking**: manifest v2 mengaitkan sebuah acceptance criterion dengan nama test yang harus sama persis dan ID check asalnya.
- **Conservative verification**: status `verified` hanya jika seluruh bukti test yang diwajibkan lulus, nama test unik, dan keseluruhan check sukses. Duplikat, skipped, missing, output terpotong, atau suite gagal tidak dianggap lulus.
- **Evidence graph**: laporan JSON menyediakan `evidenceGraph.nodes` dan `evidenceGraph.edges`, menghubungkan criterion → test → check dan criterion → file.
- **Reports**: Markdown dan HTML menampilkan hasil discovery TAP dan relasi graph. Laporan v0.2 tetap bisa dibaca oleh `compare`.
- **Backward compatibility**: manifest v1 tetap didukung. Sebaiknya gunakan v2 agar keterlacakan sampai level test case meningkat.

### Contoh evidence manifest v2

```json
{
  "version": 2,
  "criteria": {
    "AC-LOGIN": {
      "checks": [],
      "files": ["src/auth/login.ts"],
      "tests": [
        { "check": "test", "name": "rejects invalid password" },
        { "check": "test", "name": "accepts valid password" }
      ]
    }
  }
}
```

Atur command `test` menggunakan runner TAP, misalnya: `"test": ["node", "--test", "--test-reporter=tap", "tests/login.test.mjs"]`. Nama di `tests[].name` harus identik dengan title hasil TAP tingkat teratas. Bila test disusun dalam suite bertingkat, buat test tingkat atas atau check khusus; parser v0.3 sengaja mengabaikan kasus nested untuk menghindari salah atribusi.

**Catatan keterbatasan:** hubungan test dengan kriteria tetap dinyatakan eksplisit oleh maintainer. Pemeriksaan *semantik* bahwa sebuah test benar-benar mencakup seluruh perilaku belum otomatis. Tidak ada klaim verifikasi berbasis kemiripan nama semata. Ukuran log dibatasi (20 KB); kasus yang terpotong menjadi unverified.

## Yang baru dari v0.1

| Area | v0.2 |
|---|---|
| Kriteria | Stable ID `[AC-LOGIN]`, sehingga urutan daftar boleh berubah |
| Eksekusi | Check paralel dengan `maxConcurrency` 1–8 dan timeout |
| Risk engine | Deteksi file sensitif, marker private key, kemungkinan credential, ukuran perubahan, debug statements (opsional) |
| Git | Commit sejak merge base, working tree, staging, dan untracked; statistik per file |
| Output | JSON, Markdown, HTML offline, SARIF 2.1.0 |
| Pemeriksaan | `doctor`, `explain AC-ID`, `compare baseline.json current.json` |
| CI gate | `--strict` atau `strictReview: true` untuk menggagalkan pipeline pada `review` |
| Keamanan | `shell:false`, allowlist executable, redaksi output best-effort, batas output, symlink check pada config/output |

## Prasyarat

- Node.js **20+**, Git, npm, dan repository target dengan Git `main` (atau base ref lainnya).
- Untuk build ulang: TypeScript serta `@types/node` sebagai development dependencies.
- Proyek tidak membutuhkan runtime npm dependencies. Folder `dist/` telah disertakan sehingga CLI dapat dieksekusi dengan Node saja.

## Instalasi & pengujian

```bash
cd codebridge-pro-v0.3
npm install
npm run build
npm run test:run
```

**Tanpa instalasi**, jika menggunakan berkas terkompilasi dari ZIP:

```bash
node dist/cli/index.js --help
node dist/cli/index.js --version
```

## Menggunakan pada project aplikasi

Buka terminal di folder aplikasi (bukan folder CodeBridge), lalu jalankan path CLI absolut:

```bash
cd /path/ke/aplikasi
node /path/ke/codebridge-pro-v0.3/dist/cli/index.js init
```

Perbarui tiga berkas berikut:

**`goal.md`**:

```markdown
# Feature
Password Reset

## Acceptance Criteria
- [AC-REQUEST] Pengguna dapat meminta tautan reset password.
- [AC-EXPIRY] Tautan reset memiliki masa berlaku.
- [AC-LOGIN] Password baru dapat dipakai untuk login.
```

**`codebridge.config.json`** (command adalah array executable + args, bukan string shell):

```json
{
  "baseRef": "main",
  "goalFile": "goal.md",
  "evidenceFile": "codebridge.evidence.json",
  "commands": {
    "typecheck": ["npm", "run", "typecheck"],
    "test": ["npm", "run", "test:run"],
    "ac-request": ["npm", "run", "test:reset-request"],
    "ac-expiry": ["npm", "run", "test:reset-expiry"],
    "ac-login": ["npm", "run", "test:reset-login"]
  },
  "requiredChecks": ["typecheck", "test"],
  "failOn": ["critical", "high"],
  "timeoutMs": 120000,
  "maxConcurrency": 2,
  "strictReview": false,
  "outputDirectory": ".codebridge",
  "rules": {
    "enabled": true,
    "maxChangedFiles": 50,
    "maxAddedLines": 1500,
    "forbiddenPaths": [".env", ".env.*", "*.pem", "*.key"],
    "detectCredentials": true,
    "detectPrivateKeys": true,
    "detectDebugStatements": false
  }
}
```

Pastikan aplikasi memiliki scripts `test:reset-request`, `test:reset-expiry`, dan `test:reset-login`, jika contoh itu dipakai.

**`codebridge.evidence.json`**:

```json
{
  "version": 1,
  "criteria": {
    "AC-REQUEST": { "checks": ["ac-request"], "files": ["src/auth/reset.ts"], "note": "Test API permintaan reset" },
    "AC-EXPIRY": { "checks": ["ac-expiry"], "files": ["src/auth/token.ts"] },
    "AC-LOGIN": { "checks": ["ac-login"], "files": ["src/auth/login.ts"] }
  }
}
```

Cek konfigurasi lalu jalankan:

```bash
node /path/ke/codebridge-pro-v0.3/dist/cli/index.js doctor --base main
node /path/ke/codebridge-pro-v0.3/dist/cli/index.js check --base main --format all
node /path/ke/codebridge-pro-v0.3/dist/cli/index.js explain AC-REQUEST
```

Laporan tersedia di `.codebridge/`:

- `report.md`: cocok untuk PR review
- `report.json`: automasi dan integrasi
- `report.html`: dashboard statis offline (tanpa JavaScript/CDN)
- `report.sarif`: hasil static rules dalam SARIF 2.1.0

Bandingkan laporan antar run dengan:

```bash
node /path/ke/codebridge-pro-v0.3/dist/cli/index.js compare .codebridge/baseline.json .codebridge/report.json
```

Untuk gate CI yang lebih ketat:

```bash
node /path/ke/codebridge-pro-v0.3/dist/cli/index.js check --base main --strict
```

## Semantik hasil

- **verified**: setiap check yang eksplisit dipetakan ke kriteria lulus (keabsahan cakupan test tetap harus direview manusia).
- **partial**: ada file terkait yang berubah atau sebagian check terkait lulus, namun bukti belum lengkap.
- **unverified**: bukti spesifik tidak tersedia.
- **conflict**: check khusus kriteria menghasilkan failure.
- **pass**: semua kriteria verified, seluruh check lulus, tidak ada severity yang termasuk `failOn`.
- **review**: bukti kurang atau check non-required gagal; default exit `0`.
- **fail**: required check gagal, criterion conflict, atau finding dengan severity di `failOn`; exit `1`.
- **error**: kesalahan config, git, parser, atau penulisan report; exit `2`.

Tidak ada keyword matching atau AI yang diam-diam memberikan status verified.

## Perintah

```
codebridge init [--force]
codebridge doctor [--base <ref>]
codebridge check [--base <ref>] [--format all|both|json|markdown|html|sarif] [--out <dir>] [--strict] [--verbose]
codebridge explain <AC-ID> [--report <path>]
codebridge compare <baseline.json> <current.json>
```

`--no-ai` tersedia sebagai flag kompatibilitas; AI memang tidak dijalankan.

## Keamanan dan keterbatasan

1. Aturan credential merupakan **heuristik**, bisa melewatkan nilai rahasia atau memunculkan false positive. Jika indikasi real, lakukan pemeriksaan dan rotasi credential secara terpisah. Source matching tidak dimasukkan ke finding.
2. `shell:false` dan allowlist executable bukan sandbox: `npm run ...` dan `node` tetap dapat menjalankan kode repo. Gunakan hanya pada lingkungan CI tanpa secret istimewa, khususnya ketika memeriksa pull request yang tidak dipercaya.
3. Parser Git patch bekerja berdasarkan baris baru pada textual diff. Binary, patch sangat besar, untracked file lebih dari 128 KB, dan edge cases tertentu dapat luput. `git diff` memiliki batas output dan timeouts.
4. Konfigurasi JSON dan output menolak traversal/symlink pada path yang ditentukan, tetapi bukan pengamanan terhadap perubahan file secara bersamaan (TOCTOU) dari proses jahat lain.
5. `failOn` hanya mempengaruhi finding deterministic; mekanisme severity test bukan bagian dari prototype.
6. `compare` hanya membandingkan kriteria dengan ID yang sama; tidak melakukan mapping semantik ketika ID diganti.
7. Laporan SARIF hanya berisi finding dari rule engine, bukan hasil test atau acceptance criteria.
8. `maxConcurrency >1` cocok untuk independent checks. Jangan gunakan untuk script yang berbagi/memodifikasi state atau folder output yang sama.
9. Scan tidak melakukan analysis AST, security threat modeling, coverage test, atau verifikasi formal.

## License

MIT.


## Coba Smart Evidence Engine end-to-end

```bash
cd examples/demo-app
git init -b main
git add . && git -c user.name=Demo -c user.email=demo@example.org commit -m baseline
git switch -c feature/evidence-map
node ../../dist/cli/index.js doctor
node ../../dist/cli/index.js check --base main --format all
node ../../dist/cli/index.js explain AC-SUM
```

Check `test` menghasilkan TAP, dan `codebridge.evidence.json` v2 memetakan AC-SUM dan AC-NEGATIVE ke nama test yang sebenarnya. Buka `.codebridge/report.html`, atau baca field `testCases` dan `evidenceGraph` dari `report.json`. Bila Git melaporkan tidak ada perubahan, peta bukti test tetap tersedia tetapi inventaris diff kosong.

Perintah CLI tetap dapat digunakan pada source CodeBridge sendiri dari root repository setelah menjalankan `npm run build`. Manifest root saat ini kosong sehingga acceptance criteria tetap `unverified` sampai bukti spesifik dikonfigurasi — desain ini disengaja.

---

## v0.5 — GitHub PR Intelligence

v0.5 builds on the v0.3 TAP Smart Evidence Engine and provides **human-readable pull request intelligence**:

- PR summary with all criterion statuses, relevant passing evidence counts, check results, and high/critical deterministic findings.
- Optional report-to-report comparison (`--baseline`) showing regressed or improved criteria and new findings.
- Idempotent GitHub issue comment publishing with an invisible marker; the CLI updates its own existing comment, rather than spamming duplicates.
- Commit SHA binding: reports include `commitSha`; the publisher checks the current PR head and optionally an expected workflow SHA before writing.
- Strict separation between **untrusted pull-request code execution** (read-only workflow) and **trusted comment publishing** (`workflow_run` without executing PR code).

### Run locally / dry run

From a Git repository with `goal.md` and `codebridge.config.json`:

```bash
npm run build
node dist/cli/index.js check --base main --format all
node dist/cli/index.js pr-summary --report .codebridge/report.json
node dist/cli/index.js pr-comment --repo owner/repo --pr 123 --report .codebridge/report.json --dry-run
```

For comparison with an older report:

```bash
node dist/cli/index.js pr-summary --report .codebridge/report.json --baseline .codebridge/previous.json
```

To **publish**, provide a GitHub token granted permission to write issue comments and use an existing PR whose head SHA matches the report:

```bash
GITHUB_TOKEN=... node dist/cli/index.js pr-comment \
  --repo owner/repo --pr 123 --report .codebridge/report.json \
  --expected-sha YOUR_FULL_40_CHARACTER_PR_HEAD_SHA
```

`--dry-run` never calls GitHub. `--expected-sha` is strongly recommended for CI. Existing comments authored by a different account are never modified. For permission-controlled branch checks, note that CodeBridge defaults `review` to exit 0 unless `--strict` is used.

### GitHub Actions

Copy both workflows into your repository:

- `.github/workflows/codebridge-pr.yml` — runs CLI/test verification on the pull request with `contents: read` only, and uploads `.codebridge/report.json` as an artifact.
- `.github/workflows/codebridge-pr-publish.yml` — triggered by `workflow_run`, checks out **only the trusted default branch**, downloads the report as **data**, validates the report SHA against the workflow and live PR head, and posts/updates the comment.

**Important operational constraints**:

1. `workflow_run.pull_requests` may be empty for some fork PRs or GitHub event combinations; the provided workflow intentionally **skips commenting** when it cannot identify the PR. Verification still runs. This is a security-conscious limitation rather than trying to guess PR numbers.
2. If the PR head moves between the verification workflow and commenting, the publisher **rejects** the stale artifact. Re-running CI at the new commit will generate a fresh artifact.
3. Workflow files and the publisher must already exist on the repository's default branch; a malicious fork must not be able to alter the privileged publisher code.
4. The report is untrusted input. This implementation enforces SHA, basic schema validation, bounded report size, and output sanitization; do not execute anything inside the artifact.
5. To reduce supply-chain risks, pin third-party GitHub Actions to full immutable commit hashes in production and add a lockfile for reproducible npm installations. The example uses major-version tags for readability.
6. The workflow installs dev dependencies with `npm install --ignore-scripts` because the source archive has no registry-generated lockfile. After producing a trusted lockfile, switch to `npm ci --ignore-scripts`.

### v0.5 architecture

```text
pull_request (read-only)
  checkout PR head SHA
  build + test + CodeBridge check
    -> report.json with commitSha
  upload artifact
             |
             v
workflow_run (limited write permissions, trusted default branch)
  download JSON artifact (do NOT run PR code)
  validate expected workflow SHA + live PR SHA
  render bounded PR comment
  PATCH existing bot comment or POST new comment
```

**Known limitations:** no automatic historical baseline retrieval from GitHub; pass `--baseline` explicitly. No GitHub Checks API annotations yet. The existing TAP evidence-to-criterion matching still depends on explicit mappings, not AI inference. The publisher posts summary comments, not review approvals.

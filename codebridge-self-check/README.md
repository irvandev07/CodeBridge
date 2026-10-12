# CodeBridge Pro Beta v0.2

**Intent-to-Code Verification:** CLI open-source TypeScript/Node.js untuk menghubungkan acceptance criteria dengan test yang eksplisit, menganalisis perubahan Git, dan mengumpulkan evidence menjadi laporan yang dapat diaudit. **Bekerja tanpa AI**. Ini adalah developer-tool beta, belum pengganti code review atau security scanner profesional.

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
cd codebridge-pro-v0.2
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
node /path/ke/codebridge-pro-v0.2/dist/cli/index.js init
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
node /path/ke/codebridge-pro-v0.2/dist/cli/index.js doctor --base main
node /path/ke/codebridge-pro-v0.2/dist/cli/index.js check --base main --format all
node /path/ke/codebridge-pro-v0.2/dist/cli/index.js explain AC-REQUEST
```

Laporan tersedia di `.codebridge/`:

- `report.md`: cocok untuk PR review
- `report.json`: automasi dan integrasi
- `report.html`: dashboard statis offline (tanpa JavaScript/CDN)
- `report.sarif`: hasil static rules dalam SARIF 2.1.0

Bandingkan laporan antar run dengan:

```bash
node /path/ke/codebridge-pro-v0.2/dist/cli/index.js compare .codebridge/baseline.json .codebridge/report.json
```

Untuk gate CI yang lebih ketat:

```bash
node /path/ke/codebridge-pro-v0.2/dist/cli/index.js check --base main --strict
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

# CodeBridge demo app

Aplikasi Node.js sederhana yang memiliki dua acceptance criteria dengan test khusus.

## Demo (di terminal)

```bash
cd examples/demo-app
npm test
git init -b main
git config user.name "Demo User"
git config user.email "demo@example.test"
git add .
git commit -m "Initial demo"
node ../../dist/cli/index.js doctor
node ../../dist/cli/index.js check --format all
```

Dari directory demo-app, `../../dist/cli/index.js` menunjuk ke binary CodeBridge dalam paket yang sama. Jika penyiapan Git sudah dilakukan, keputusan seharusnya `PASS` (semua check khusus yang dipetakan lulus; tidak ada temuan risk rule).

Coba ubah `src/calculator.js` sehingga operasi menjadi `a - b`, lalu jalankan `check` lagi. Mapping kriteria akan menjadi `conflict` dan exit code menjadi `1` karena check terkait gagal. Kembalikan implementasi agar lulus.

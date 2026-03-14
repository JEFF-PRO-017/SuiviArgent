import { Component } from '@angular/core';
import { GoogleSheetsService } from './lib/@google-sheets/google-sheets.service';

const SPREADSHEET_ID = 'TON_SPREADSHEET_ID';
const SHEET_NAME = 'BenchmarkTest';

export interface TestResult {
  key: string;
  label: string;
  unit: string;
  icon: string;
  value: string | null;
  status: 'idle' | 'running' | 'done' | 'error';
}

export interface LogEntry {
  time: string;
  msg: string;
  type: 'info' | 'success' | 'error' | 'start';
}
@Component({
  selector: 'app-root',
  // imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'SuiviArgent';

  running = false;
  logs: LogEntry[] = [];

  results: TestResult[] = [
    { key: 'writeSpeed', label: "Vitesse d'écriture", unit: 'ms/ligne', icon: '✍️', value: null, status: 'idle' },
    { key: 'writeConcurrency', label: 'Concurrence écriture', unit: 'req/s', icon: '⚡', value: null, status: 'idle' },
    { key: 'readSpeed', label: 'Vitesse de lecture', unit: 'ms/lecture', icon: '📖', value: null, status: 'idle' },
    { key: 'maxFlux', label: 'Flux max réception', unit: 'lignes/s', icon: '🌊', value: null, status: 'idle' },
    { key: 'parallelWrite', label: 'Écriture parallèle', unit: 'ms total', icon: '🔀', value: null, status: 'idle' },
    { key: 'updateTime', label: 'Temps mise à jour', unit: 'ms/update', icon: '🔄', value: null, status: 'idle' },
    { key: 'parallelUpdate', label: 'Mise à jour parallèle', unit: 'ms total', icon: '⚙️', value: null, status: 'idle' },
  ];

  constructor(private sheets: GoogleSheetsService) {
    this.sheets.createSheet({
      sheetName: SHEET_NAME,
      headers: ['key','label','unit','icon','value','status']
    })
   }

  // ─────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────

  private setStatus(key: string, status: TestResult['status']): void {
    const r = this.results.find(r => r.key === key);
    if (r) r.status = status;
  }

  private setValue(key: string, value: string): void {
    const r = this.results.find(r => r.key === key);
    if (r) r.value = value;
  }

  private addLog(msg: string, type: LogEntry['type'] = 'info'): void {
    const time = new Date().toLocaleTimeString();
    this.logs = [...this.logs.slice(-80), { msg, type, time }];
    setTimeout(() => {
      const el = document.getElementById('log-console');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      idle: '#334155', running: '#f59e0b', done: '#10b981', error: '#ef4444'
    };
    return map[status] || '#334155';
  }

  getLogColor(type: string): string {
    const map: Record<string, string> = {
      info: '#94a3b8', success: '#10b981', error: '#f87171', start: '#38bdf8'
    };
    return map[type] || '#94a3b8';
  }

  // ─────────────────────────────────────────
  // 1. VITESSE D'ÉCRITURE SÉQUENTIELLE
  // ─────────────────────────────────────────

  async testWriteSpeed(): Promise<void> {
    this.setStatus('writeSpeed', 'running');
    this.addLog("🧪 Test vitesse écriture — 10 lignes séquentielles...");
    const N = 10;
    const times: number[] = [];

    for (let i = 0; i < N; i++) {
      const t0 = performance.now();
      try {
        await this.sheets.addRow({
          // spreadsheetId: SPREADSHEET_ID,
          sheetName: SHEET_NAME,
          rowData: [`write_${i}`, `valeur_${i}`, Date.now()]
        });
        const elapsed = performance.now() - t0;
        times.push(elapsed);
        this.addLog(`  Ligne ${i + 1}/${N} → ${elapsed.toFixed(0)}ms`);
      } catch (e) {
        this.addLog(`  ❌ Ligne ${i + 1} échouée`, 'error');
        this.setStatus('writeSpeed', 'error');
        return;
      }
    }

    const avg = times.reduce((a, b) => a + b, 0) / N;
    this.setValue('writeSpeed', avg.toFixed(1));
    this.setStatus('writeSpeed', 'done');
    this.addLog(`✅ Moy écriture : ${avg.toFixed(1)}ms/ligne`, 'success');
  }

  // ─────────────────────────────────────────
  // 2. CONCURRENCE ÉCRITURE
  // ─────────────────────────────────────────

  async testWriteConcurrency(): Promise<void> {
    this.setStatus('writeConcurrency', 'running');
    this.addLog("🧪 Test concurrence écriture — 20 req simultanées...");
    const N = 20;
    const t0 = performance.now();

    try {
      await Promise.all(
        Array.from({ length: N }, (_, i) =>
          this.sheets.addRow({
            // spreadsheetId: SPREADSHEET_ID,
            sheetName: SHEET_NAME,
            rowData: [`concurrent_${i}`, Date.now()]
          }).then(() => this.addLog(`  Req ${i + 1} complétée`))
        )
      );
      const elapsed = (performance.now() - t0) / 1000;
      const rps = (N / elapsed).toFixed(2);
      this.setValue('writeConcurrency', rps);
      this.setStatus('writeConcurrency', 'done');
      this.addLog(`✅ Débit : ${rps} req/s en ${elapsed.toFixed(2)}s`, 'success');
    } catch (e) {
      this.setStatus('writeConcurrency', 'error');
      this.addLog('❌ Erreur concurrence écriture', 'error');
    }
  }

  // ─────────────────────────────────────────
  // 3. VITESSE DE LECTURE
  // ─────────────────────────────────────────

  async testReadSpeed(): Promise<void> {
    this.setStatus('readSpeed', 'running');
    this.addLog("🧪 Test vitesse lecture — 5 lectures par ID...");
    const times: number[] = [];

    for (let i = 1; i <= 5; i++) {
      const t0 = performance.now();
      try {
        await this.sheets.findRowById(SHEET_NAME, `write_${i}`);
        const elapsed = performance.now() - t0;
        times.push(elapsed);
        this.addLog(`  Lecture ${i}/5 → ${elapsed.toFixed(0)}ms`);
      } catch (e) {
        this.addLog(`  ❌ Lecture ${i} échouée`, 'error');
      }
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    this.setValue('readSpeed', avg.toFixed(1));
    this.setStatus('readSpeed', 'done');
    this.addLog(`✅ Moy lecture : ${avg.toFixed(1)}ms`, 'success');
  }

  // ─────────────────────────────────────────
  // 4. FLUX MAX DE RÉCEPTION
  // ─────────────────────────────────────────

  async testMaxFlux(): Promise<void> {
    this.setStatus('maxFlux', 'running');
    this.addLog("🧪 Test flux max — 50 lectures simultanées...");
    const N = 50;
    const t0 = performance.now();

    try {
      await Promise.all(
        Array.from({ length: N }, (_, i) =>
          this.sheets.findRowById( SHEET_NAME, `write_${i % 10}`)
        )
      );
      const elapsed = (performance.now() - t0) / 1000;
      const lps = (N / elapsed).toFixed(1);
      this.setValue('maxFlux', lps);
      this.setStatus('maxFlux', 'done');
      this.addLog(`✅ Flux max : ${lps} lignes/s en ${elapsed.toFixed(2)}s`, 'success');
    } catch (e) {
      this.setStatus('maxFlux', 'error');
      this.addLog('❌ Erreur flux max', 'error');
    }
  }

  // ─────────────────────────────────────────
  // 5. ÉCRITURE PARALLÈLE
  // ─────────────────────────────────────────

  async testParallelWrite(): Promise<void> {
    this.setStatus('parallelWrite', 'running');
    this.addLog("🧪 Test écriture parallèle — 15 lignes simultanées...");
    const t0 = performance.now();

    try {
      await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          this.sheets.addRow({
            // spreadsheetId: SPREADSHEET_ID,
            sheetName: SHEET_NAME,
            rowData: [`parallel_${i}`, `data_${i}`, Date.now()]
          }).then(() => this.addLog(`  Ligne parallèle ${i + 1} écrite`))
        )
      );
      const elapsed = performance.now() - t0;
      this.setValue('parallelWrite', elapsed.toFixed(0));
      this.setStatus('parallelWrite', 'done');
      this.addLog(`✅ 15 lignes en parallèle : ${elapsed.toFixed(0)}ms total`, 'success');
    } catch (e) {
      this.setStatus('parallelWrite', 'error');
      this.addLog('❌ Erreur écriture parallèle', 'error');
    }
  }

  // ─────────────────────────────────────────
  // 6. TEMPS DE MISE À JOUR
  // ─────────────────────────────────────────

  async testUpdateTime(): Promise<void> {
    this.setStatus('updateTime', 'running');
    this.addLog("🧪 Test temps mise à jour — 8 cellules séquentielles...");
    const times: number[] = [];

    for (let i = 1; i <= 8; i++) {
      const row = await this.sheets.findRowById( SHEET_NAME, `write_${i}`);
      if (row === -1) {
        this.addLog(`  ⚠️ ID write_${i} non trouvé, ignoré`);
        continue;
      }
      const t0 = performance.now();
      try {
        await this.sheets.updateCell({
          // spreadsheetId: SPREADSHEET_ID,
          sheetName: SHEET_NAME,
          row, col: 2,
          value: `updated_${Date.now()}`
        });
        const elapsed = performance.now() - t0;
        times.push(elapsed);
        this.addLog(`  Update ${i}/8 → ${elapsed.toFixed(0)}ms`);
      } catch (e) {
        this.addLog(`  ❌ Update ${i} échouée`, 'error');
      }
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    this.setValue('updateTime', avg.toFixed(1));
    this.setStatus('updateTime', 'done');
    this.addLog(`✅ Moy update : ${avg.toFixed(1)}ms/cellule`, 'success');
  }

  // ─────────────────────────────────────────
  // 7. MISE À JOUR PARALLÈLE
  // ─────────────────────────────────────────

  async testParallelUpdate(): Promise<void> {
    this.setStatus('parallelUpdate', 'running');
    this.addLog("🧪 Test mise à jour parallèle — 10 cellules simultanées...");
    const t0 = performance.now();

    try {
      const updates = Array.from({ length: 10 }, async (_, i) => {
        const row = await this.sheets.findRowById( SHEET_NAME, `concurrent_${i}`);
        if (row === -1) return;
        await this.sheets.updateCell({
          // spreadsheetId: SPREADSHEET_ID,
          sheetName: SHEET_NAME,
          row, col: 2,
          value: `parallel_update_${Date.now()}`
        });
        this.addLog(`  Cellule ${i + 1} mise à jour`);
      });

      await Promise.all(updates);
      const elapsed = performance.now() - t0;
      this.setValue('parallelUpdate', elapsed.toFixed(0));
      this.setStatus('parallelUpdate', 'done');
      this.addLog(`✅ 10 updates parallèles : ${elapsed.toFixed(0)}ms total`, 'success');
    } catch (e) {
      this.setStatus('parallelUpdate', 'error');
      this.addLog('❌ Erreur mise à jour parallèle', 'error');
    }
  }

  // ─────────────────────────────────────────
  // LANCER TOUS LES TESTS
  // ─────────────────────────────────────────

  async runAll(): Promise<void> {
    this.running = true;
    this.logs = [];
    this.results.forEach(r => { r.status = 'idle'; r.value = null; });
    this.addLog('🚀 Démarrage benchmark complet Google Sheets...', 'start');

    await this.testWriteSpeed();
    await this.testWriteConcurrency();
    await this.testReadSpeed();
    await this.testMaxFlux();
    await this.testParallelWrite();
    await this.testUpdateTime();
    await this.testParallelUpdate();

    this.addLog('🏁 Benchmark terminé !', 'success');
    this.running = false;
  }
}
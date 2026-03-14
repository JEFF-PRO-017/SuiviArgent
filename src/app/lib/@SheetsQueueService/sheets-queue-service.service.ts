import { effect, Injectable, signal } from '@angular/core';
import { CellConfig, DeleteRowConfig, GoogleSheetsService, RowConfig } from '../@google-sheets/google-sheets.service';
import { from, EMPTY, of } from 'rxjs';
import { switchMap, map, catchError, filter, tap } from 'rxjs/operators';


interface QueueItem {
  id: string;
  payload: RowConfig | CellConfig | DeleteRowConfig | any;
  order: 'addRow' | 'updateCell' | 'deleteRow'
}

interface SheetsQueueServiceServiceInterface {
  enqueue(payload: any, order: 'addRow' | 'updateCell' | 'deleteRow'): void; //enfiler
  dequeue(): void; //defiler
  peek(): QueueItem;//renvoi le prenier element 
  isEmpty(): boolean; //est vide
  size(): number; //taille
}

const STORAGE_KEY = 'sheets_queue';
const SCHEDULED = 2000

@Injectable({
  providedIn: 'root'
})
export class SheetsQueueServiceService implements SheetsQueueServiceServiceInterface {

  private queue = signal<QueueItem[]>([]);
  private online = signal(navigator.onLine);
  private scheduled: any;
  private syncing = false; // verrou anti-doublon
  constructor(
    private sheets: GoogleSheetsService
  ) {
    this.queue.set(this.load()) //rechargement de l'ancienne version
    window.addEventListener('online', () => {
      this.online.set(true);
    });
    window.addEventListener('offline', () => {
      this.online.set(false);
    })
    effect(() => {
      this.save()
      if (this.online() && this.queue().length > 0) this.startScheduler();
    })
  }

  private startScheduler(): void {
    if (this.scheduled) return;
    this.scheduled = setInterval(() => {
      if (this.isEmpty()) {
        clearInterval(this.scheduled);
        this.scheduled = null;
        return;
      }
      this.sync();
    }, SCHEDULED);
  }
  enqueue(payload: RowConfig | CellConfig | DeleteRowConfig, order: 'addRow' | 'updateCell' | 'deleteRow'): void {
    this.queue.update(list => [{ id: crypto.randomUUID(), payload, order }, ...list]);
  }

  dequeue(): void {
    this.queue.update(list => list.slice(1));
  }

  peek(): QueueItem {
    return this.queue()[0];
  }
  isEmpty(): boolean {
    return this.size() === 0
  }

  size(): number {
    return this.queue().length;
  }


  sync(): void {

    // Garde : déjà en cours, hors ligne ou file vide
    if (this.syncing || !this.online() || this.isEmpty()) return;

    this.syncing = true;

    const item = this.peek();

    of(item).pipe(

      // Vérifie que l'item est valide avant d'envoyer
      filter(i => !!i && !!i.order && !!i.payload),

      // Mappe vers l'appel réseau — switchMap annule toute requête précédente
      // si sync() est rappelé avant la fin (protection doublon côté Observable)
      switchMap(i =>
        from(this.sheets[i.order](i.payload)).pipe(
          map(() => i) // propage l'item en cas de succès
        )
      ),

      // Succès
      tap(i => {
        this.dequeue();
        console.log(`✅ Envoyé : ${i.id}`);
      }),

      // Échec : log et ne retire pas l'item — il reste en tête pour le prochain sync
      catchError(err => {
        console.warn(`⚠️ Échec — ${item.id} conservé en tête :`, err?.message ?? err);
        return EMPTY; // absorbe l'erreur, ne crash pas le flux
      }),

    ).subscribe({
      complete: () => { this.syncing = false; }, // libère le verrou
      error: () => { this.syncing = false; }, // sécurité (ne devrait pas arriver après catchError)
    });
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue()))
  }

  private load(): QueueItem[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') ?? []
    } catch {
      return []
    }
  }

}

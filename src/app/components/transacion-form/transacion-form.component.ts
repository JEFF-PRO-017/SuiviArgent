import { Component, computed, signal, OnInit, HostBinding, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SheetsQueueServiceService } from '../../lib/@SheetsQueueService/sheets-queue-service.service';
import { GoogleSheetsService, RowConfig } from '../../lib/@google-sheets/google-sheets.service';

type EntryType = 'in' | 'out';
const SHEET_NAME = 'transactions';

// ── Suggestions contexte scolaire ─────────────────────────────────────────────
const SUGGESTIONS: Record<EntryType, string[]> = {
  in: [
    'Frais de scolarité',
    'Frais d\'inscription',
    'Subvention gouvernementale',
    'Don / Mécénat',
    'Frais d\'examen',
    'Aide sociale',
    'Vente de fournitures',
    'Cotisation parents d\'élèves',
    'Activités périscolaires',
    'Concours / Compétitions',
  ],
  out: [
    'Salaires enseignants',
    'Salaires personnel administratif',
    'Fournitures scolaires',
    'Eau / Électricité',
    'Entretien bâtiments',
    'Achat mobilier / équipements',
    'Transport scolaire',
    'Frais administratifs',
    'Réparations',
    'Activités parascolaires',
    'Matériel informatique',
    'Formation du personnel',
  ],
};

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transacion-form.component.html',
  styleUrl: './transacion-form.component.scss',
})
export class TransactionFormComponent implements OnInit {

  // ── État ───────────────────────────────────────────────────────────────────
  type           = signal<EntryType>('in');
  darkMode       = signal(false);
  amount         = '';
  amountFormatted = '';
  justif         = '';
  date           = this.todayISO();
  activeShortcut = 0;
  showSuggestions = false;

  // ── Suggestions filtrées ──────────────────────────────────────────────────
  filteredSuggestions = computed(() => {
    const list = SUGGESTIONS[this.type()];
    if (!this.justif) return list;
    return list.filter(s => s.toLowerCase().includes(this.justif.toLowerCase()));
  });

  showCustomOption = computed(() =>
    this.justif.length > 2 &&
    !SUGGESTIONS[this.type()].some(s => s.toLowerCase() === this.justif.toLowerCase())
  );

  // ── Raccourcis date (multi-année) ─────────────────────────────────────────
  readonly shortcuts = [
    { label: "Aujourd'hui", offset: 0    },
    { label: 'Hier',        offset: -1   },
    { label: '−7 jours',   offset: -7   },
    { label: '−30 jours',  offset: -30  },
  ];

  constructor(
    private sheets: SheetsQueueServiceService,
    private sheetsGoogle: GoogleSheetsService,
  ) {}

  ngOnInit(): void {
    this.sheetsGoogle.createSheet({
      sheetName: SHEET_NAME,
      headers: ['Key', 'Type', 'Amount', 'Justif', 'Date'],
    });
  }

  // ── Type ──────────────────────────────────────────────────────────────────
  setType(t: EntryType): void {
    this.type.set(t);
    this.justif = '';
    this.showSuggestions = false;
  }

  // ── Montant avec séparateur ───────────────────────────────────────────────
  onAmountInput(): void {
    const val = parseFloat(this.amount);
    this.amountFormatted = isNaN(val) || val === 0
      ? ''
      : val.toLocaleString('fr-FR') + ' FCFA';
  }

  // ── Justification + suggestions ───────────────────────────────────────────
  onJustifFocus(): void  { this.showSuggestions = true;  }
  onJustifBlur(): void   { setTimeout(() => this.showSuggestions = false, 150); }
  onJustifInput(): void  { this.showSuggestions = true;  }

  pickSuggestion(s: string): void {
    this.justif = s;
    this.showSuggestions = false;
  }

  // ── Date ──────────────────────────────────────────────────────────────────
  setDateShortcut(offset: number, index: number): void {
    this.date = this.todayISO(offset);
    this.activeShortcut = index;
  }

  onDateInput(): void { this.activeShortcut = -1; }

  // ── Thème ─────────────────────────────────────────────────────────────────
  toggleDark(): void { this.darkMode.update(v => !v); }

  // ── Soumission ────────────────────────────────────────────────────────────
  submit(): void {
    const a = parseFloat(this.amount);
    if (!a || a <= 0 || !this.justif.trim() || !this.date) return;

    const row: RowConfig = {
      sheetName: SHEET_NAME,
      rowData: [crypto.randomUUID(), this.type(), a, this.justif.trim(), this.date],
    };

    this.sheets.enqueue(row, 'addRow');
    this.amount = '';
    this.amountFormatted = '';
    this.justif = '';
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────
  private todayISO(offset = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }
}
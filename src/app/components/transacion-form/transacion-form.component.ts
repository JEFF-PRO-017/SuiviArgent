import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { SheetsQueueServiceService } from '../../lib/@SheetsQueueService/sheets-queue-service.service';
import { GoogleSheetsService, RowConfig } from '../../lib/@google-sheets/google-sheets.service';

type EntryType = 'in' | 'out';
const SHEET_NAME = 'TRANSACTIONS';

const SUGGESTIONS: Record<EntryType, string[]> = {
  in: [
    'Frais de scolarité',
    "Frais d'inscription",
    'Subvention gouvernementale',
    'Don / Mécénat',
    "Frais d'examen",
    'Aide sociale',
    'Vente de fournitures',
    "Cotisation parents d'élèves",
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
  imports: [CommonModule, ReactiveFormsModule, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './transacion-form.component.html',
  styleUrl: './transacion-form.component.scss',
})
export class TransactionFormComponent implements OnInit {

  // ── Signals ───────────────────────────────────────────────────────────────
  type     = signal<EntryType>('in');
  darkMode = signal(false);

  // ── Formulaire réactif ────────────────────────────────────────────────────
  form = new FormGroup({
    amount: new FormControl('', [Validators.required, Validators.min(1)]),
    justif: new FormControl('', [Validators.required, Validators.minLength(2)]),
    date:   new FormControl(this.todayISO(), Validators.required),
  });

  // ── Suggestions ───────────────────────────────────────────────────────────
  showSuggestions = false;
  activeShortcut  = 0;

  filteredSuggestions = computed(() => {
    const val  = this.form.get('justif')?.value ?? '';
    const list = SUGGESTIONS[this.type()];
    return val.length === 0
      ? list
      : list.filter(s => s.toLowerCase().includes(val.toLowerCase()));
  });

  showCustomOption = computed(() => {
    const val  = this.form.get('justif')?.value ?? '';
    const list = SUGGESTIONS[this.type()];
    return val.length > 2 && !list.some(s => s.toLowerCase() === val.toLowerCase());
  });

  // ── Raccourcis date ───────────────────────────────────────────────────────
  readonly shortcuts = [
    { label: "Aujourd'hui", offset: 0   },
    { label: 'Hier',        offset: -1  },
    { label: '−7 jours',   offset: -7  },
    { label: '−30 jours',  offset: -30 },
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

  // ── Helpers template ──────────────────────────────────────────────────────
  get amountCtrl() { return this.form.get('amount')!; }
  get justifCtrl() { return this.form.get('justif')!; }
  get dateCtrl()   { return this.form.get('date')!;   }

  isInvalid(ctrl: FormControl|any): boolean {
    return ctrl.invalid && ctrl.touched;
  }

  // ── Type ──────────────────────────────────────────────────────────────────
  setType(t: EntryType): void {
    this.type.set(t);
    this.justifCtrl.reset('');
    this.showSuggestions = false;
  }

  // ── Suggestions ───────────────────────────────────────────────────────────
  onJustifFocus(): void { this.showSuggestions = true; }
  onJustifBlur(): void  { setTimeout(() => this.showSuggestions = false, 150); }

  pickSuggestion(s: string): void {
    this.justifCtrl.setValue(s);
    this.justifCtrl.markAsTouched();
    this.showSuggestions = false;
  }

  // ── Date ──────────────────────────────────────────────────────────────────
  setDateShortcut(offset: number, index: number): void {
    this.dateCtrl.setValue(this.todayISO(offset));
    this.activeShortcut = index;
  }

  onDateInput(): void { this.activeShortcut = -1; }

  // ── Thème ─────────────────────────────────────────────────────────────────
  toggleDark(): void { this.darkMode.update(v => !v); }

  // ── Soumission ────────────────────────────────────────────────────────────
  submit(): void {
    debugger
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    // ngx-mask retourne la valeur avec espaces — on retire pour stocker le chiffre pur
    // const rawAmount = parseFloat(
    //   (this.amountCtrl.value ?? '').replace(/\s/g, '')
    // );

    const row: RowConfig = {
      sheetName: SHEET_NAME,
      rowData: [
        crypto.randomUUID(),
        this.type(),
        this.amountCtrl.value,
        this.justifCtrl.value!.trim(),
        this.dateCtrl.value!,
      ],
    };

    this.sheets.enqueue(row, 'addRow');

    this.amountCtrl.reset('');
    this.justifCtrl.reset('');
    this.amountCtrl.markAsUntouched();
    this.justifCtrl.markAsUntouched();
  }

  // ── Utilitaires ───────────────────────────────────────────────────────────
  private todayISO(offset = 0): string {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
  }
}
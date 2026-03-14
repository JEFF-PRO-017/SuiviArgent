import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import * as jose from 'jose';
import { environment } from '../../../../environment';


export interface SheetConfig{
  sheetName: string;
  headers: string[];
}

export interface RowConfig {
  sheetName: string;
  rowData: any[];
}

export interface CellConfig {
  sheetName: string;
  row: number;
  col: number;
  value: any;
}

export interface DeleteRowConfig {
  sheetName: string;
  rowIndex: number;
}

interface IGoogleSheetsService {
  createSheet(config: SheetConfig): Promise<void>;
  addRow(config: RowConfig): Promise<void>;
  updateCell(config: CellConfig): Promise<void>;
  deleteRow(config: DeleteRowConfig): Promise<void>;
  findRowById(spreadsheetId: string, sheetName: string, id: any): Promise<number>;
}

@Injectable({ providedIn: 'root' })
export class GoogleSheetsService implements IGoogleSheetsService {

  private readonly BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
  private readonly SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(private http: HttpClient) {
    this.refreshToken();
  }

  // ─────────────────────────────────────────
  // AUTHENTIFICATION JWT
  // ─────────────────────────────────────────

  private async refreshToken(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    const privateKey = await jose.importPKCS8(
      environment.googlePrivateKey.replace(/\\n/g, '\n'),
      'RS256'
    );

    const jwt = await new jose.SignJWT({ scope: this.SCOPE })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(environment.googleServiceAccountEmail)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    const response: any = await firstValueFrom(
      this.http.post('https://oauth2.googleapis.com/token', null, {
        params: {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }
      })
    );

    this.accessToken = response.access_token;
    this.tokenExpiry = now + 3500;
    console.log('✅ Token Google rafraîchi');
  }

  private async getHeaders(): Promise<HttpHeaders> {
    const now = Math.floor(Date.now() / 1000);
    if (!this.accessToken || now >= this.tokenExpiry) {
      await this.refreshToken();
    }
    return new HttpHeaders({
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    });
  }

  // ─────────────────────────────────────────
  // UTILITAIRE : construire les URLs ranges
  // ─────────────────────────────────────────

  /**
   * Encode uniquement le nom de la feuille (qui peut contenir des espaces,
   * des apostrophes, etc.), puis colle le reste de la plage sans ré-encoder.
   *
   * Exemples :
   *   rangeUrl('Sheet 1', 'A1')          → "Sheet%201!A1"
   *   rangeUrl('BenchmarkTest', 'A1')    → "BenchmarkTest!A1"
   *   appendUrl('BenchmarkTest', 'A1')   → "BenchmarkTest!A1:append"
   */
  private rangeUrl(sheetName: string, cells: string): string {
    return `${encodeURIComponent(sheetName)}!${cells}`;
  }

  private appendUrl(sheetName: string, cells: string): string {
    // FIX : :append doit rester en dehors de l'encodage
    return `${encodeURIComponent(sheetName)}!${cells}:append`;
  }

  // ─────────────────────────────────────────
  // 1. CRÉER UNE FEUILLE
  // ─────────────────────────────────────────

  async createSheet(config: SheetConfig): Promise<void> {
    const headers = await this.getHeaders();

    const file: any = await firstValueFrom(
      this.http.get(`${this.BASE_URL}/${environment.spreadsheetId}`, { headers })
    );

    const exists = file.sheets?.some(
      (s: any) => s.properties?.title === config.sheetName
    );

    if (exists) {
      console.warn(`⚠️ Feuille "${config.sheetName}" existe déjà`);
      return;
    }

    await firstValueFrom(
      this.http.post(
        `${this.BASE_URL}/${environment.spreadsheetId}:batchUpdate`,
        { requests: [{ addSheet: { properties: { title: config.sheetName } } }] },
        { headers }
      )
    );

    // FIX : utiliser rangeUrl() pour encoder correctement
    await firstValueFrom(
      this.http.put(
        `${this.BASE_URL}/${environment.spreadsheetId}/values/${this.rangeUrl(config.sheetName, 'A1')}?valueInputOption=RAW`,
        { values: [config.headers] },
        { headers }
      )
    );

    console.log(`✅ Feuille "${config.sheetName}" créée`);
  }

  // ─────────────────────────────────────────
  // 2. AJOUTER UNE LIGNE
  // ─────────────────────────────────────────

  async addRow(config: RowConfig): Promise<void> {
    const headers = await this.getHeaders();

    // FIX PRINCIPAL : utiliser appendUrl() — :append ne doit PAS être encodé
    await firstValueFrom(
      this.http.post(
        `${this.BASE_URL}/${environment.spreadsheetId}/values/${this.appendUrl(config.sheetName, 'A1')}?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { values: [config.rowData] },
        { headers }
      )
    );

    console.log(`✅ Ligne ajoutée dans "${config.sheetName}"`);
  }

  // ─────────────────────────────────────────
  // 3. MODIFIER UNE CELLULE
  // ─────────────────────────────────────────

  async updateCell(config: CellConfig): Promise<void> {
    const headers = await this.getHeaders();
    const cellRef = `${this.columnToLetter(config.col)}${config.row}`;

    // FIX : utiliser rangeUrl() ici aussi
    await firstValueFrom(
      this.http.put(
        `${this.BASE_URL}/${environment.spreadsheetId}/values/${this.rangeUrl(config.sheetName, cellRef)}?valueInputOption=RAW`,
        { values: [[config.value]] },
        { headers }
      )
    );

    console.log(`✅ Cellule ${config.sheetName}!${cellRef} mise à jour`);
  }

  // ─────────────────────────────────────────
  // 4. SUPPRIMER UNE LIGNE
  // ─────────────────────────────────────────

  async deleteRow(config: DeleteRowConfig): Promise<void> {
    if (config.rowIndex === 0) {
      throw new Error('❌ Impossible de supprimer la ligne des en-têtes');
    }

    const headers = await this.getHeaders();
    const sheetId = await this.getSheetId(config.sheetName);

    await firstValueFrom(
      this.http.post(
        `${this.BASE_URL}/${environment.spreadsheetId}:batchUpdate`,
        {
          requests: [{
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: config.rowIndex,
                endIndex: config.rowIndex + 1,
              }
            }
          }]
        },
        { headers }
      )
    );

    console.log(`✅ Ligne ${config.rowIndex + 1} supprimée`);
  }

  // ─────────────────────────────────────────
  // UTILITAIRES
  // ─────────────────────────────────────────

  async findRowById(
    sheetName: string,
    id: any
  ): Promise<number> {
    const headers = await this.getHeaders();

    const response: any = await firstValueFrom(
      this.http.get(
        // FIX : utiliser rangeUrl() pour encoder le nom de la feuille
        `${this.BASE_URL}/${environment.spreadsheetId}/values/${this.rangeUrl(sheetName, 'A:A')}`,
        { headers }
      )
    );

    const rows: any[][] = response.values ?? [];
    const rowIndex = rows.findIndex((row) => row[0] === String(id));
    return rowIndex === -1 ? -1 : rowIndex + 1;
  }

  private async getSheetId(sheetName: string): Promise<number> {
    const headers = await this.getHeaders();

    const response: any = await firstValueFrom(
      this.http.get(`${this.BASE_URL}/${environment.spreadsheetId}`, { headers })
    );

    const sheet = response.sheets?.find(
      (s: any) => s.properties?.title === sheetName
    );

    if (!sheet) throw new Error(`❌ Feuille "${sheetName}" introuvable`);
    return sheet.properties.sheetId;
  }

  private columnToLetter(col: number): string {
    let letter = '';
    while (col > 0) {
      const mod = (col - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      col = Math.floor((col - 1) / 26);
    }
    return letter;
  }
}
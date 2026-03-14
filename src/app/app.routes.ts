import { Routes } from '@angular/router';
import { TestShceetComponent } from './components/test-shceet/test-shceet.component';
import { TransactionFormComponent } from './components/transacion-form/transacion-form.component';

export const routes: Routes = [
    { path: '', component: TransactionFormComponent },
    { path: 'test', component: TestShceetComponent },
];
